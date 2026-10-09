-- Revues périodiques (IA, traitements RGPD, processus, tiers) : date de dernière revue et anti-doublon de la relance.
-- AlterTable
ALTER TABLE "Traitement" ADD COLUMN     "derniereRevue" DATE,
ADD COLUMN     "revueRappelLe" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SystemeIA" ADD COLUMN     "revueRappelLe" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Processus" ADD COLUMN     "derniereRevue" DATE,
ADD COLUMN     "revueRappelLe" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tier" ADD COLUMN     "derniereRevue" DATE,
ADD COLUMN     "revueRappelLe" TIMESTAMP(3);

