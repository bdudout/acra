-- Reporting réglementaire : toggle + critères DORA sur les incidents.
ALTER TABLE "OrganizationConfig" ADD COLUMN IF NOT EXISTS "reglementaireActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "doraCriteres" JSONB NOT NULL DEFAULT '{}';
