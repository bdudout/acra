-- Module conformité activé par défaut (nouveau défaut + activation des orgs existantes).
ALTER TABLE "OrganizationConfig" ALTER COLUMN "conformiteActive" SET DEFAULT true;
UPDATE "OrganizationConfig" SET "conformiteActive" = true WHERE "conformiteActive" = false;
