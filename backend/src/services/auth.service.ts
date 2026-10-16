import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  generateVerificationCode,
  hashVerificationCode,
  verificationCodeMatches,
  VERIFICATION_CODE_EXPIRY_MINUTES,
  MAX_VERIFICATION_ATTEMPTS,
  VERIFICATION_RESEND_COOLDOWN_SECONDS,
} from "../utils/email-verification.utils.js";
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  getPasswordResetExpiry,
} from "../utils/password-reset.utils.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "./email.service.js";
import {
  hashPassword,
  comparePassword,
  generateToken,
} from "../utils/auth.utils.js";
import { ApiError } from "../utils/api-error.js";
import { deleteFromS3 } from "./s3-delete.service.js";

const databaseUrl = new URL(process.env.DATABASE_URL!);
databaseUrl.searchParams.delete("sslmode");

const poolConfig = {
  connectionString: databaseUrl.toString(),
  ...(process.env.NODE_ENV === "production"
    ? {
        ssl: {
          ca: readFileSync("/etc/ssl/certs/rds-eu-west-1-bundle.pem", "utf8"),
          rejectUnauthorized: true,
        },
      }
    : {}),
};

const adapter = new PrismaPg(poolConfig);
const prisma = new PrismaClient({ adapter });

export const getTokenVersionForAuth = async (
  userId: string,
): Promise<number | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenVersion: true },
  });
  return user?.tokenVersion ?? null;
};

const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

const publicUser = (user: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
});

export const registerUser = async (
  firstName: string,
  lastName: string,
  email: string,
  password: string,
) => {
  const normalizedEmail = normalizeEmail(email);

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw new ApiError(
      409,
      "Email already registered",
      "EMAIL_ALREADY_REGISTERED",
    );
  }

  const passwordHash = await hashPassword(password);
  const code = generateVerificationCode();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000,
  );

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email: normalizedEmail,
      passwordHash,
      emailVerified: false,
      emailVerificationCodeHash: hashVerificationCode(code),
      emailVerificationExpiresAt: expiresAt,
      emailVerificationSentAt: now,
      emailVerificationAttempts: 0,
    },
  });

  try {
    await sendVerificationEmail({
      to: user.email,
      firstName: user.firstName,
      code,
    });
  } catch {
    // Clear the unusable code so the account can request another one.
    await prisma.user.updateMany({
      where: {
        id: user.id,
        emailVerificationCodeHash: hashVerificationCode(code),
        emailVerificationSentAt: now,
      },
      data: {
        emailVerificationCodeHash: null,
        emailVerificationExpiresAt: null,
        emailVerificationSentAt: null,
        emailVerificationAttempts: 0,
      },
    });

    throw new ApiError(
      503,
      "Your account was created, but the verification email could not be sent. Please request another code.",
      "VERIFICATION_EMAIL_FAILED",
    );
  }

  return {
    user: publicUser(user),
    message: "Account created. Check your email for your verification code.",
  };
};

export const verifyEmail = async (email: string, code: string) => {
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new ApiError(
      400,
      "Invalid or expired verification code",
      "INVALID_VERIFICATION_CODE",
    );
  }

  if (user.emailVerified) {
    throw new ApiError(
      409,
      "Email is already verified. Please log in.",
      "EMAIL_ALREADY_VERIFIED",
    );
  }

  if (
    !user.emailVerificationCodeHash ||
    !user.emailVerificationExpiresAt ||
    user.emailVerificationExpiresAt.getTime() <= Date.now()
  ) {
    throw new ApiError(
      400,
      "Invalid or expired verification code. Request a new one.",
      "INVALID_VERIFICATION_CODE",
    );
  }

  if (user.emailVerificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
    throw new ApiError(
      429,
      "Too many attempts. Request a new verification code.",
      "VERIFICATION_ATTEMPTS_EXCEEDED",
    );
  }

  if (
    !verificationCodeMatches(
      code,
      user.emailVerificationCodeHash,
    )
  ) {
    const attempts = user.emailVerificationAttempts + 1;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationAttempts: attempts,
        ...(attempts >= MAX_VERIFICATION_ATTEMPTS
          ? {
              emailVerificationCodeHash: null,
              emailVerificationExpiresAt: null,
            }
          : {}),
      },
    });

    throw new ApiError(
      attempts >= MAX_VERIFICATION_ATTEMPTS ? 429 : 400,
      attempts >= MAX_VERIFICATION_ATTEMPTS
        ? "Too many attempts. Request a new verification code."
        : "Invalid or expired verification code",
      attempts >= MAX_VERIFICATION_ATTEMPTS
        ? "VERIFICATION_ATTEMPTS_EXCEEDED"
        : "INVALID_VERIFICATION_CODE",
    );
  }

  const verifiedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
      emailVerificationSentAt: null,
      emailVerificationAttempts: 0,
    },
  });

  return {
    user: publicUser(verifiedUser),
    token: generateToken(verifiedUser.id, verifiedUser.tokenVersion),
    message: "Email verified successfully.",
  };
};

export const resendVerificationEmail = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  const genericResponse = {
    message:
      "If an unverified account exists for that email, a verification code will be sent when permitted.",
  };

  if (!user || user.emailVerified) {
    return genericResponse;
  }

  if (
    user.emailVerificationSentAt &&
    Date.now() - user.emailVerificationSentAt.getTime() <
      VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000
  ) {
    return genericResponse;
  }

  const code = generateVerificationCode();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000,
  );

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationCodeHash: hashVerificationCode(code),
      emailVerificationExpiresAt: expiresAt,
      emailVerificationSentAt: now,
      emailVerificationAttempts: 0,
    },
  });

  try {
    await sendVerificationEmail({
      to: user.email,
      firstName: user.firstName,
      code,
    });
  } catch {
    // Clear only the code created by this resend request.
    // This avoids overwriting a newer code if requests overlap.
    await prisma.user.updateMany({
      where: {
        id: user.id,
        emailVerificationCodeHash: hashVerificationCode(code),
        emailVerificationSentAt: now,
      },
      data: {
        emailVerificationCodeHash: null,
        emailVerificationExpiresAt: null,
        emailVerificationSentAt: null,
        emailVerificationAttempts: 0,
      },
    });

    throw new ApiError(
      503,
      "Unable to send the verification email right now. Please request another code.",
      "VERIFICATION_EMAIL_FAILED",
    );
  }

  return genericResponse;
};

export const loginUser = async (email: string, password: string) => {
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new ApiError(
      401,
      "Invalid email or password",
      "INVALID_CREDENTIALS",
    );
  }

  const passwordIsValid = await comparePassword(
    password,
    user.passwordHash,
  );

  if (!passwordIsValid) {
    throw new ApiError(
      401,
      "Invalid email or password",
      "INVALID_CREDENTIALS",
    );
  }

  if (!user.emailVerified) {
    throw new ApiError(
      403,
      "Please verify your email before logging in.",
      "EMAIL_NOT_VERIFIED",
    );
  }

  return {
    user: publicUser(user),
    token: generateToken(user.id, user.tokenVersion),
  };
};

export const deleteAccount = async (
  userId: string,
  currentPassword: string,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    throw new ApiError(404, "User not found", "USER_NOT_FOUND");
  }

  const passwordIsValid = await comparePassword(
    currentPassword,
    user.passwordHash,
  );

  if (!passwordIsValid) {
    throw new ApiError(
      401,
      "Current password is incorrect",
      "INVALID_CREDENTIALS",
    );
  }

  const files = await prisma.file.findMany({
    where: { userId },
    select: {
      id: true,
      s3Key: true,
    },
  });

  for (const file of files) {
    try {
      await deleteFromS3(file.s3Key);
    } catch {
      throw new ApiError(
        502,
        "File cleanup was incomplete. Your account has not been deleted. Some stored files may already have been removed. Please contact support.",
        "S3_CLEANUP_FAILED",
      );
    }

    try {
      await prisma.file.delete({
        where: { id: file.id },
      });
    } catch {
      throw new ApiError(
        500,
        "A stored file was removed, but its database record could not be cleaned up. Your account has not been deleted. Please contact support.",
        "ACCOUNT_DELETE_FAILED",
      );
    }
  }

  try {
    await prisma.user.delete({
      where: { id: userId },
    });
  } catch {
    throw new ApiError(
      500,
      "Stored files were cleaned up, but the account could not be deleted. Please contact support.",
      "ACCOUNT_DELETE_FAILED",
    );
  }

  return { message: "Account deleted successfully" };
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found", "USER_NOT_FOUND");
  }

  return user;
};


const PASSWORD_RESET_GENERIC_MESSAGE =
  "If an account exists for that email, password-reset instructions will be sent.";

export const requestPasswordReset = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // Keep the response the same when the email is not registered.
  if (!user) {
    return { message: PASSWORD_RESET_GENERIC_MESSAGE };
  }

  const token = generatePasswordResetToken();
  const tokenHash = hashPasswordResetToken(token);
  const expiresAt = getPasswordResetExpiry();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: expiresAt,
    },
  });

  const frontendUrl = (
    process.env.FRONTEND_URL || "http://localhost:5173"
  ).replace(/\/$/, "");

  const resetLink =
    `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

  try {
    await sendPasswordResetEmail({
      to: user.email,
      firstName: user.firstName,
      resetLink,
    });
  } catch (error) {
    // Clear only the token created by this request.
    await prisma.user.updateMany({
      where: {
        id: user.id,
        passwordResetTokenHash: tokenHash,
      },
      data: {
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    });

    console.error("Password-reset email could not be sent.");
    // Do not reveal account existence or email delivery details.
  }

  return { message: PASSWORD_RESET_GENERIC_MESSAGE };
};

export const resetPassword = async (
  token: string,
  newPassword: string,
) => {
  const tokenHash = hashPasswordResetToken(token);
  const now = new Date();

  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { gt: now },
    },
    select: { id: true },
  });

  if (!user) {
    throw new ApiError(
      400,
      "This password-reset link is invalid or has expired. Please request another one.",
      "INVALID_OR_EXPIRED_RESET_TOKEN",
    );
  }

  const passwordHash = await hashPassword(newPassword);

  // The conditional update prevents reuse and competing reset requests.
  const result = await prisma.user.updateMany({
    where: {
      id: user.id,
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { gt: new Date() },
    },
    data: {
      passwordHash,
      tokenVersion: { increment: 1 },
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  });

  if (result.count !== 1) {
    throw new ApiError(
      400,
      "This password-reset link is invalid or has expired. Please request another one.",
      "INVALID_OR_EXPIRED_RESET_TOKEN",
    );
  }

  return { message: "Password reset successful. You can now log in." };
};
