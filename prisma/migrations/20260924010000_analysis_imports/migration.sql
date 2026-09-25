CREATE TABLE "AnalysisImport" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'API_V2',
  "payloadHash" TEXT NOT NULL,
  "analyseId" TEXT NOT NULL,
  "response" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalysisImport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnalysisImport_organizationId_idempotencyKey_key" ON "AnalysisImport"("organizationId", "idempotencyKey");
CREATE INDEX "AnalysisImport_analyseId_idx" ON "AnalysisImport"("analyseId");
ALTER TABLE "AnalysisImport" ADD CONSTRAINT "AnalysisImport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
