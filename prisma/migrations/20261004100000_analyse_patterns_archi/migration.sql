-- Patterns d'architecture de SI par analyse (liste de codes) et plafond de sélection par organisation (additif).
ALTER TABLE "Analyse" ADD COLUMN "patternsArchi" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "OrganizationConfig" ADD COLUMN "patternsArchiMax" INTEGER;
