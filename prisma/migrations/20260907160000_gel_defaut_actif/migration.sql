-- Gel après acceptation : activé par défaut (gouvernance)
ALTER TABLE "OrganizationConfig" ALTER COLUMN "gelApresAcceptationActive" SET DEFAULT true;
UPDATE "OrganizationConfig" SET "gelApresAcceptationActive" = true;
