-- AlterTable
ALTER TABLE "Analyse" ADD COLUMN     "qualification" JSONB;

-- AlterTable
ALTER TABLE "OrganizationConfig" ADD COLUMN     "conformiteActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qualificationActive" BOOLEAN NOT NULL DEFAULT false;
