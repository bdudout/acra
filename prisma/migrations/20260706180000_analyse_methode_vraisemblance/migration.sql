-- Méthode d'évaluation de la vraisemblance (label EBIOS RM §EXI_M4_07)
ALTER TABLE "Analyse" ADD COLUMN "methodeVraisemblance" TEXT NOT NULL DEFAULT 'EXPRESSE';
