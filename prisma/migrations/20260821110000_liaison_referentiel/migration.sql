-- Liaison contrôle/audit ↔ référentiel + exigences (conformité dérivée)
ALTER TABLE "Controle" ADD COLUMN "referentielCode" TEXT;
ALTER TABLE "Controle" ADD COLUMN "exigenceRefs" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "AuditConstat" ADD COLUMN "referentielCode" TEXT;
ALTER TABLE "AuditConstat" ADD COLUMN "exigenceRef" TEXT;
CREATE INDEX "Controle_referentielCode_idx" ON "Controle"("referentielCode");
CREATE INDEX "AuditConstat_referentielCode_idx" ON "AuditConstat"("referentielCode");
