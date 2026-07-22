-- Identité configurable de l'application (nom + baseline), niveau instance.
ALTER TABLE "Configuration"
  ADD COLUMN IF NOT EXISTS "appName"     TEXT,
  ADD COLUMN IF NOT EXISTS "appBaseline" TEXT;
