-- Méthode d'analyse de risque configurable (cf. docs/methodes-analyse-cadrage.md).
-- Défaut EBIOS_RM : les analyses existantes restent EBIOS RM (rétrocompatibilité).
ALTER TABLE "Analyse" ADD COLUMN "methode" TEXT NOT NULL DEFAULT 'EBIOS_RM';
