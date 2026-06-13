-- Mode d'évaluation de la matrice des risques (quantitatif/qualitatif)
ALTER TABLE "Configuration" ADD COLUMN "matriceMode" TEXT NOT NULL DEFAULT 'QUANTITATIVE';
ALTER TABLE "Configuration" ADD COLUMN "matriceQualitative" JSONB;
