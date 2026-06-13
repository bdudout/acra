-- AlterTable: add passwordChangedAt to User
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

-- CreateTable: PasswordPolicy (singleton global, id = 'global')
CREATE TABLE "PasswordPolicy" (
    "id"               TEXT NOT NULL DEFAULT 'global',
    "minLength"        INTEGER NOT NULL DEFAULT 8,
    "requireUppercase" BOOLEAN NOT NULL DEFAULT false,
    "requireLowercase" BOOLEAN NOT NULL DEFAULT false,
    "requireNumbers"   BOOLEAN NOT NULL DEFAULT false,
    "requireSpecial"   BOOLEAN NOT NULL DEFAULT false,
    "maxAgeDays"       INTEGER NOT NULL DEFAULT 0,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordPolicy_pkey" PRIMARY KEY ("id")
);

-- Seed default policy row
INSERT INTO "PasswordPolicy" ("id", "minLength", "requireUppercase", "requireLowercase", "requireNumbers", "requireSpecial", "maxAgeDays", "updatedAt")
VALUES ('global', 8, false, false, false, false, 0, NOW())
ON CONFLICT ("id") DO NOTHING;
