-- AlterTable
ALTER TABLE "PartiePrenante" ADD COLUMN     "cle" TEXT,
ADD COLUMN     "parentCle" TEXT,
ADD COLUMN     "rang" INTEGER NOT NULL DEFAULT 1;

