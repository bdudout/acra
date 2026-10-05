-- Anti-doublon de la relance des demandes de suppression d'un risque de projet (additif).
ALTER TABLE "Risque" ADD COLUMN "suppressionRappelLe" TIMESTAMP(3);
