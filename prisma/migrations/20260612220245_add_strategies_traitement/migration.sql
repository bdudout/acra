-- AlterTable
ALTER TABLE "OrganizationConfig" ADD COLUMN     "strategiesTraitement" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "PasswordPolicy" ALTER COLUMN "minLength" SET DEFAULT 12,
ALTER COLUMN "requireUppercase" SET DEFAULT true,
ALTER COLUMN "requireLowercase" SET DEFAULT true,
ALTER COLUMN "requireNumbers" SET DEFAULT true,
ALTER COLUMN "requireSpecial" SET DEFAULT true,
ALTER COLUMN "maxAgeDays" SET DEFAULT 90,
ALTER COLUMN "maxFailedAttempts" SET DEFAULT 5,
ALTER COLUMN "mfaConfirmationDeadline" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SSOConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;
