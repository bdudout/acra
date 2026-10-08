-- Registre des traitements : critères AIPD des lignes directrices WP248 rév. 01 cochés par le DPO. Migration additive.
-- AlterTable
ALTER TABLE "Traitement" ADD COLUMN     "criteresAipd" JSONB NOT NULL DEFAULT '[]';

