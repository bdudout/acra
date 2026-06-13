-- AlterTable: add account lockout fields to PasswordPolicy
ALTER TABLE "PasswordPolicy"
  ADD COLUMN "maxFailedAttempts"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockoutDurationMinutes" INTEGER NOT NULL DEFAULT 15;
