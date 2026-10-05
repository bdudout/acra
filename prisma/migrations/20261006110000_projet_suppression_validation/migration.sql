-- Projet 360 : suppression d'un risque soumise à validation (RM, ou RSSI si cyber) — additif.
ALTER TABLE "OrganizationConfig" ADD COLUMN "projetSuppressionValidation" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Risque" ADD COLUMN "suppressionDemandeePar" TEXT;
ALTER TABLE "Risque" ADD COLUMN "suppressionDemandeeLe" TIMESTAMP(3);
