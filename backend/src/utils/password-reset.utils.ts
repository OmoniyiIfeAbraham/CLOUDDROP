import { createHash, randomBytes } from "node:crypto";

export const PASSWORD_RESET_EXPIRY_MINUTES = 30;

export const generatePasswordResetToken = (): string => {
  return randomBytes(32).toString("hex");
};

export const hashPasswordResetToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

export const getPasswordResetExpiry = (): Date => {
  return new Date(
    Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000,
  );
};
