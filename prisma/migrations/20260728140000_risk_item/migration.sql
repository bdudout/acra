-- Socle GRC : registre de risques canonique (RiskItem)
CREATE TABLE IF NOT EXISTS "RiskItem" (
  "id"                      TEXT NOT NULL,
  "organizationId"          TEXT NOT NULL,
  "intitule"                TEXT NOT NULL,
  "description"             TEXT,
  "taxonomieCode"           TEXT,
  "processusId"             TEXT,
  "entite"                  TEXT,
  "proprietaire"            TEXT,
  "graviteInherente"        INTEGER,
  "vraisemblanceInherente"  INTEGER,
  "graviteResiduelle"       INTEGER,
  "vraisemblanceResiduelle" INTEGER,
  "statut"                  TEXT NOT NULL DEFAULT 'IDENTIFIE',
  "provenance"              TEXT NOT NULL DEFAULT 'MANUEL',
  "sourceType"              TEXT,
  "sourceId"                TEXT,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RiskItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RiskItem_organizationId_idx" ON "RiskItem"("organizationId");
CREATE INDEX IF NOT EXISTS "RiskItem_processusId_idx" ON "RiskItem"("processusId");
CREATE INDEX IF NOT EXISTS "RiskItem_taxonomieCode_idx" ON "RiskItem"("taxonomieCode");
DO $$ BEGIN
  ALTER TABLE "RiskItem" ADD CONSTRAINT "RiskItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "RiskItem" ADD CONSTRAINT "RiskItem_processusId_fkey" FOREIGN KEY ("processusId") REFERENCES "Processus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
