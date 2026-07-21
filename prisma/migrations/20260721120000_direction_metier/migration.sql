-- Rôle Direction métier + acceptation des risques résiduels (distincte de la validation de l'analyse).
ALTER TYPE "UserRole" ADD VALUE 'DIRECTION_METIER';

ALTER TABLE "Analyse" ADD COLUMN "risquesResiduelsStatut" TEXT NOT NULL DEFAULT 'EN_ATTENTE';
ALTER TABLE "Analyse" ADD COLUMN "risquesResiduelsPar" TEXT;
ALTER TABLE "Analyse" ADD COLUMN "risquesResiduelsLe" TIMESTAMP(3);
ALTER TABLE "Analyse" ADD COLUMN "risquesResiduelsCommentaire" TEXT;

ALTER TABLE "OrganizationConfig" ADD COLUMN "acceptationRisquesActive" BOOLEAN NOT NULL DEFAULT false;
