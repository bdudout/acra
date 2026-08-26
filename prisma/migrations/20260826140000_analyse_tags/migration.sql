-- Tags / programme des analyses (regroupement pour les grandes organisations)
ALTER TABLE "Analyse" ADD COLUMN "tags" JSONB NOT NULL DEFAULT '[]';
