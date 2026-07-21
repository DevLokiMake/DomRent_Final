-- AlterTable: добавляем флаг подтверждения email.
-- DEFAULT true — чтобы существующие пользователи не были заблокированы задним числом.
-- Новые self-registered пользователи получают isEmailVerified=false из authController.js.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isEmailVerified" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: EmailVerificationToken (аналог PasswordResetToken)
CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
    "token"     TEXT NOT NULL,
    "userId"    INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("token")
);

-- AddForeignKey
ALTER TABLE "EmailVerificationToken"
    ADD CONSTRAINT "EmailVerificationToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");
