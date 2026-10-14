import {
  createHash,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

export const VERIFICATION_CODE_EXPIRY_MINUTES = 10;
export const MAX_VERIFICATION_ATTEMPTS = 5;
export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

export const generateVerificationCode = (): string =>
  randomInt(0, 1_000_000).toString().padStart(6, "0");

export const hashVerificationCode = (code: string): string =>
  createHash("sha256").update(code).digest("hex");

export const verificationCodeMatches = (
  submittedCode: string,
  storedHash: string,
): boolean => {
  if (!/^\d{6}$/.test(submittedCode) || !/^[a-f0-9]{64}$/i.test(storedHash)) {
    return false;
  }

  const submittedHash = Buffer.from(
    hashVerificationCode(submittedCode),
    "hex",
  );
  const expectedHash = Buffer.from(storedHash, "hex");

  return (
    submittedHash.length === expectedHash.length &&
    timingSafeEqual(submittedHash, expectedHash)
  );
};
