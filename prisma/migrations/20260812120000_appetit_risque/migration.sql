-- Appétit au risque : configuration JSON par organisation (seuil global + par catégorie).
ALTER TABLE "OrganizationConfig" ADD COLUMN IF NOT EXISTS "appetitRisque" JSONB NOT NULL DEFAULT '{}';
