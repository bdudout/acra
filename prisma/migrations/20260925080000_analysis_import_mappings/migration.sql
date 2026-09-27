CREATE TABLE "AnalysisImportMapping" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mappings" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalysisImportMapping_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnalysisImportMapping_organizationId_name_key" ON "AnalysisImportMapping"("organizationId", "name");
CREATE INDEX "AnalysisImportMapping_organizationId_idx" ON "AnalysisImportMapping"("organizationId");
ALTER TABLE "AnalysisImportMapping" ADD CONSTRAINT "AnalysisImportMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
