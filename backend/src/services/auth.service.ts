import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
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

export const registerUser = async (
  firstName: string,
  lastName: string,
  email: string,
  password: string,
) => {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ApiError(
      409,
      "Email already registered",
      "EMAIL_ALREADY_REGISTERED",
    );
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      passwordHash,
    },
  });

  const token = generateToken(user.id);

  return {
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
    token,
  };
};

export const loginUser = async (
  email: string,
  password: string,
) => {
  const user = await prisma.user.findUnique({
    where: { email },
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

  const token = generateToken(user.id);

  return {
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
    token,
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
    throw new ApiError(
      404,
      "User not found",
      "USER_NOT_FOUND",
    );
  }

  return user;
};
