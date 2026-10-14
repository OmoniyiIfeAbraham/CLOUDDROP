-- Add email verification fields.
ALTER TABLE "User"
ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "emailVerificationCodeHash" TEXT,
ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3),
ADD COLUMN "emailVerificationSentAt" TIMESTAMP(3),
ADD COLUMN "emailVerificationAttempts" INTEGER NOT NULL DEFAULT 0;

-- Preserve existing accounts when verification is introduced.
UPDATE "User"
SET "emailVerified" = true;
