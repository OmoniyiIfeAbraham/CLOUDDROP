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
import { sendVerificationEmail } from "./email.service.js";
import {
  hashPassword,
  comparePassword,
  generateToken,
} from "../utils/auth.utils.js";
import { ApiError } from "../utils/api-error.js";

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
    token: generateToken(verifiedUser.id),
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
    token: generateToken(user.id),
  };
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
