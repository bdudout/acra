-- Gel de l'analyse après acceptation des risques résiduels (lecture seule + nouvelle version requise)
ALTER TABLE "OrganizationConfig" ADD COLUMN "gelApresAcceptationActive" BOOLEAN NOT NULL DEFAULT false;
