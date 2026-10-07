-- Fichiers d'un projet 360 : document rattaché à une analyse projet (additif, nullable).
ALTER TABLE "Document" ADD COLUMN "analyseId" TEXT;
CREATE INDEX "Document_analyseId_idx" ON "Document"("analyseId");
