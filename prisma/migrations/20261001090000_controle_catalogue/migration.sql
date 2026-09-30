-- Provenance des contrôles-types proposés par le catalogue sectoriel (idempotence de l'import).
ALTER TABLE "Controle" ADD COLUMN "catalogueKey" TEXT, ADD COLUMN "catalogueVersion" TEXT;
CREATE UNIQUE INDEX "Controle_organizationId_catalogueKey_key" ON "Controle"("organizationId", "catalogueKey");
