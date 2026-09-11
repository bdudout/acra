-- Criticité DORA (FCI) + objectifs de continuité (RTO=DIMA, RPO=PDMA) sur les processus.
ALTER TABLE "Processus" ADD COLUMN "criticiteDora" TEXT;
ALTER TABLE "Processus" ADD COLUMN "rtoMinutes" INTEGER;
ALTER TABLE "Processus" ADD COLUMN "rpoMinutes" INTEGER;
