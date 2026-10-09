-- Anti-doublon de la relance « AIPD requise non engagée » (cron relances, destinataire : DPO).
ALTER TABLE "Traitement" ADD COLUMN "aipdRappelLe" TIMESTAMP(3);
