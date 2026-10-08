-- CreateTable
CREATE TABLE "Share" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Share_token_key" ON "Share"("token");

-- CreateIndex
CREATE INDEX "Share_fileId_idx" ON "Share"("fileId");

-- CreateIndex
CREATE INDEX "Share_expiresAt_idx" ON "Share"("expiresAt");

-- CreateIndex
CREATE INDEX "File_userId_category_idx" ON "File"("userId", "category");

-- CreateIndex
CREATE INDEX "File_userId_createdAt_idx" ON "File"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
