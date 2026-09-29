-- Lot L3 « Contrôle permanent » : typologie, conception, contrôles automatiques.
ALTER TABLE "Controle" ADD COLUMN "typeControle" TEXT;
ALTER TABLE "Controle" ADD COLUMN "modeControle" TEXT NOT NULL DEFAULT 'MANUEL';
ALTER TABLE "Controle" ADD COLUMN "cle" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Controle" ADD COLUMN "methodeEchantillon" TEXT;
ALTER TABLE "Controle" ADD COLUMN "conception" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "ControleExecution" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'SAISIE';
