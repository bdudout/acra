-- AddColumn: referentielMesures on Analyse
ALTER TABLE "Analyse" ADD COLUMN "referentielMesures" TEXT DEFAULT 'ISO27001';

-- AddColumn: customControles on Cadrage
ALTER TABLE "Cadrage" ADD COLUMN "customControles" JSONB;
