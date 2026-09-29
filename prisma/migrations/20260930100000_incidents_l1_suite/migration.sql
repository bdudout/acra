-- Lot L1 (suite) : chronologie, cause racine, impacts non financiers, allocation des pertes.
ALTER TABLE "Incident" ADD COLUMN "chronologie" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Incident" ADD COLUMN "causeRacine" TEXT;
ALTER TABLE "Incident" ADD COLUMN "causeDetail" TEXT;
ALTER TABLE "Incident" ADD COLUMN "leconsApprises" TEXT;
ALTER TABLE "Incident" ADD COLUMN "impactsNonFinanciers" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Incident" ADD COLUMN "allocations" JSONB NOT NULL DEFAULT '[]';
