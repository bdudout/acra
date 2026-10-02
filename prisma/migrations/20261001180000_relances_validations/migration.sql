-- Relances des validations en attente (analyses soumises, dérogations en revue).
ALTER TABLE "Analyse" ADD COLUMN "soumisLe" TIMESTAMP(3);
ALTER TABLE "Analyse" ADD COLUMN "rappelLe" TIMESTAMP(3);
ALTER TABLE "Derogation" ADD COLUMN "rappelLe" TIMESTAMP(3);
-- Analyses déjà soumises : meilleure approximation disponible de la date de soumission.
UPDATE "Analyse" SET "soumisLe" = "updatedAt" WHERE "statut" = 'SOUMIS';
