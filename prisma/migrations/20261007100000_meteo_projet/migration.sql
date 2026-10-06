-- Météo d'un projet 360 réglée par le chef de projet (additif, nullable).
ALTER TABLE "Analyse" ADD COLUMN "meteoProjet" TEXT;
ALTER TABLE "Analyse" ADD COLUMN "meteoProjetLe" TIMESTAMP(3);
