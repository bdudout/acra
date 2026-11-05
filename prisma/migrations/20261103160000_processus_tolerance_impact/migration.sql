-- Tolérance d'impact des processus (durée maximale d'interruption tolérable, minutes). Ajout facultatif (expand).
ALTER TABLE "Processus" ADD COLUMN "toleranceImpactMinutes" INTEGER;
