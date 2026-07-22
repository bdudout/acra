-- Dérogation autonome (niveau organisation) : analyseId devient optionnel
ALTER TABLE "Derogation" ALTER COLUMN "analyseId" DROP NOT NULL;
