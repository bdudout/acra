-- KRI proposés par le catalogue sectoriel : seuils facultatifs (« à définir ») et provenance stable.
ALTER TABLE "Kri" ALTER COLUMN "seuilAlerte" DROP NOT NULL, ALTER COLUMN "seuilCritique" DROP NOT NULL;
ALTER TABLE "Kri" ADD COLUMN "catalogueKey" TEXT, ADD COLUMN "catalogueVersion" TEXT;
CREATE UNIQUE INDEX "Kri_organizationId_catalogueKey_key" ON "Kri"("organizationId", "catalogueKey");
