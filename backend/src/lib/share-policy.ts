import { randomBytes } from "node:crypto";

export const DEFAULT_SHARE_TTL_HOURS = 24;
export const MAX_SHARE_TTL_HOURS = 168;

export const createShareToken = (): string => {
  return randomBytes(12).toString("base64url");
};

export const resolveShareExpiry = (
  ttlHours: number = DEFAULT_SHARE_TTL_HOURS,
  now: Date = new Date()
): Date => {
  if (
    !Number.isFinite(ttlHours) ||
    ![1, 24, 168].includes(ttlHours)
  ) {
    throw new Error("Share TTL must be 1, 24, or 168 hours");
  }

  return new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
};

export const isShareExpired = (expiresAt: Date, now: Date = new Date()): boolean => {
  return expiresAt.getTime() <= now.getTime();
};
