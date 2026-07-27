-- Politique d'activation des modules au niveau instance (SUPER_ADMIN)
ALTER TABLE "Configuration" ADD COLUMN IF NOT EXISTS "modulesPolicy" JSONB NOT NULL DEFAULT '{}';
