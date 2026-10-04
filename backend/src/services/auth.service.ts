import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  hashPassword,
  comparePassword,
  generateToken,
} from "../utils/auth.utils.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

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
    throw new Error("Email already registered");
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
    throw new Error("Invalid email or password");
  }

  const passwordIsValid = await comparePassword(
    password,
    user.passwordHash,
  );

  if (!passwordIsValid) {
    throw new Error("Invalid email or password");
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
    throw new Error("User not found");
  }

  return user;
};

