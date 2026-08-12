-- Module M4 : audit interne (missions + constats) + toggle du module
ALTER TABLE "OrganizationConfig" ADD COLUMN IF NOT EXISTS "auditInterneActive" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "AuditMission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "objectif" TEXT,
    "perimetre" TEXT,
    "responsable" TEXT,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'PLANIFIEE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuditMission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditConstat" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "description" TEXT,
    "recommandation" TEXT,
    "criticite" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'AUDIT_INTERNE',
    "responsableAction" TEXT,
    "echeance" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'OUVERT',
    "riskItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuditConstat_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditMission_organizationId_idx" ON "AuditMission"("organizationId");
CREATE INDEX IF NOT EXISTS "AuditMission_statut_idx" ON "AuditMission"("statut");
CREATE INDEX IF NOT EXISTS "AuditConstat_missionId_idx" ON "AuditConstat"("missionId");
CREATE INDEX IF NOT EXISTS "AuditConstat_organizationId_idx" ON "AuditConstat"("organizationId");
CREATE INDEX IF NOT EXISTS "AuditConstat_statut_idx" ON "AuditConstat"("statut");
CREATE INDEX IF NOT EXISTS "AuditConstat_riskItemId_idx" ON "AuditConstat"("riskItemId");

DO $$ BEGIN
  ALTER TABLE "AuditMission" ADD CONSTRAINT "AuditMission_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AuditConstat" ADD CONSTRAINT "AuditConstat_missionId_fkey"
    FOREIGN KEY ("missionId") REFERENCES "AuditMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AuditConstat" ADD CONSTRAINT "AuditConstat_riskItemId_fkey"
    FOREIGN KEY ("riskItemId") REFERENCES "RiskItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
