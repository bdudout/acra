-- Missions d'audit types proposées par le catalogue sectoriel : provenance stable (idempotence de l'import).
ALTER TABLE "AuditMission" ADD COLUMN "catalogueKey" TEXT, ADD COLUMN "catalogueVersion" TEXT;
CREATE UNIQUE INDEX "AuditMission_organizationId_catalogueKey_key" ON "AuditMission"("organizationId", "catalogueKey");
