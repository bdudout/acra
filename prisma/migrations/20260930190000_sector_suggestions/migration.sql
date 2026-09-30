-- Additive and nullable provenance: no rewrite of existing, user-edited data.
ALTER TABLE "Organization" ADD COLUMN "secteursActivite" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Processus" ADD COLUMN "catalogueKey" TEXT, ADD COLUMN "catalogueVersion" TEXT;
ALTER TABLE "RiskItem" ADD COLUMN "catalogueKey" TEXT, ADD COLUMN "catalogueVersion" TEXT;

CREATE UNIQUE INDEX "Processus_organizationId_catalogueKey_key" ON "Processus"("organizationId", "catalogueKey");
CREATE UNIQUE INDEX "RiskItem_organizationId_catalogueKey_key" ON "RiskItem"("organizationId", "catalogueKey");
