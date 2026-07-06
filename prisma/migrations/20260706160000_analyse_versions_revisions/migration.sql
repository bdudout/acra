-- Versions x.y de l'analyse + historique des révisions (label EBIOS RM §3.4)
CREATE TYPE "CycleRevision" AS ENUM ('OPERATIONNEL', 'STRATEGIQUE');

ALTER TABLE "Analyse" ADD COLUMN "versionMajeure" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Analyse" ADD COLUMN "versionMineure" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "RevisionAnalyse" (
    "id" TEXT NOT NULL,
    "analyseId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "cycle" "CycleRevision" NOT NULL DEFAULT 'OPERATIONNEL',
    "note" TEXT,
    "ateliers" INTEGER[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RevisionAnalyse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RevisionAnalyse_analyseId_idx" ON "RevisionAnalyse"("analyseId");

ALTER TABLE "RevisionAnalyse" ADD CONSTRAINT "RevisionAnalyse_analyseId_fkey"
  FOREIGN KEY ("analyseId") REFERENCES "Analyse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
