-- Socle GRC : taxonomie de risques personnalisable + toggle du module Registre/Cartographie
ALTER TABLE "OrganizationConfig"
  ADD COLUMN IF NOT EXISTS "taxonomieRisques"      JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "registreRisquesActive" BOOLEAN NOT NULL DEFAULT false;
