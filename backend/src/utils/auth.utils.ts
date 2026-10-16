import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

export const comparePassword = async (
  password: string,
  passwordHash: string,
): Promise<boolean> => {
  return bcrypt.compare(password, passwordHash);
};

export const generateToken = (userId: string, tokenVersion = 0): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign({ userId, tokenVersion }, secret, { expiresIn: "7d" });
};

