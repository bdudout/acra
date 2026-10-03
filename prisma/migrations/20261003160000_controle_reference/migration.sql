-- P3 — contrôles de référence en réseau (additif).
ALTER TABLE "Controle" ADD COLUMN "estReference" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Controle" ADD COLUMN "referenceId" TEXT;
CREATE INDEX "Controle_referenceId_idx" ON "Controle"("referenceId");
CREATE UNIQUE INDEX "Controle_organizationId_referenceId_key" ON "Controle"("organizationId", "referenceId");
