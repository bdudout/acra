-- Module M2 : incidents & pertes (LDC) + toggle d'activation du module
ALTER TABLE "OrganizationConfig" ADD COLUMN IF NOT EXISTS "incidentsActive" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "Incident" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "description" TEXT,
    "dateSurvenance" TIMESTAMP(3),
    "dateDetection" TIMESTAMP(3),
    "taxonomieCode" TEXT,
    "processusId" TEXT,
    "entite" TEXT,
    "impactEstime" INTEGER,
    "montantBrut" DECIMAL(14,2),
    "recuperations" DECIMAL(14,2),
    "riskItemId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'DECLARE',
    "declarantId" TEXT NOT NULL,
    "qualifiePar" TEXT,
    "qualifieLe" TIMESTAMP(3),
    "clotureLe" TIMESTAMP(3),
    "clotureCommentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Incident_organizationId_idx" ON "Incident"("organizationId");
CREATE INDEX IF NOT EXISTS "Incident_statut_idx" ON "Incident"("statut");
CREATE INDEX IF NOT EXISTS "Incident_riskItemId_idx" ON "Incident"("riskItemId");
CREATE INDEX IF NOT EXISTS "Incident_processusId_idx" ON "Incident"("processusId");
CREATE INDEX IF NOT EXISTS "Incident_taxonomieCode_idx" ON "Incident"("taxonomieCode");

DO $$ BEGIN
  ALTER TABLE "Incident" ADD CONSTRAINT "Incident_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Incident" ADD CONSTRAINT "Incident_processusId_fkey"
    FOREIGN KEY ("processusId") REFERENCES "Processus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Incident" ADD CONSTRAINT "Incident_riskItemId_fkey"
    FOREIGN KEY ("riskItemId") REFERENCES "RiskItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
