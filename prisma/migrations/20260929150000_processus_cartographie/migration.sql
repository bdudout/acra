-- Processus de cartographie des risques personnalisable (vide = texte par défaut).
ALTER TABLE "OrganizationConfig" ADD COLUMN "processusCartographie" JSONB NOT NULL DEFAULT '{}';
