-- Recette n° 45 : anti-doublon des relances « incident à qualifier » et « KRI en alerte ou critique ».
ALTER TABLE "Incident" ADD COLUMN "rappelLe" TIMESTAMP(3);
ALTER TABLE "Kri" ADD COLUMN "alerteeLe" TIMESTAMP(3);
