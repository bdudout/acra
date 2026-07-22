-- Niveaux de workflow de dérogation + double regard optionnel
ALTER TABLE "OrganizationConfig"
  ADD COLUMN IF NOT EXISTS "derogationWorkflow"     TEXT NOT NULL DEFAULT 'RSSI',
  ADD COLUMN IF NOT EXISTS "derogationDoubleRegard" BOOLEAN NOT NULL DEFAULT true;
