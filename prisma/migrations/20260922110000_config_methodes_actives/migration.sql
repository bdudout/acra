-- Méthodes d'analyse activées au niveau instance (SUPER_ADMIN).
-- Défaut EBIOS RM seul ; rétrocompatible (aucune autre méthode activée d'office).
ALTER TABLE "Configuration" ADD COLUMN "methodesActives" JSONB NOT NULL DEFAULT '["EBIOS_RM"]';
