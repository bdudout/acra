-- Module KRI : toggle + tables Kri et KriMesure.
ALTER TABLE "OrganizationConfig" ADD COLUMN IF NOT EXISTS "kriActive" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "Kri" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "description" TEXT,
    "unite" TEXT,
    "sens" TEXT NOT NULL DEFAULT 'HAUSSE',
    "seuilAlerte" DOUBLE PRECISION NOT NULL,
    "seuilCritique" DOUBLE PRECISION NOT NULL,
    "frequence" TEXT NOT NULL DEFAULT 'MENSUEL',
    "responsable" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "taxonomieCode" TEXT,
    "riskItemId" TEXT,
    "processusId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Kri_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KriMesure" (
    "id" TEXT NOT NULL,
    "kriId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "valeur" DOUBLE PRECISION NOT NULL,
    "dateMesure" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commentaire" TEXT,
    "saisiPar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KriMesure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Kri_organizationId_idx" ON "Kri"("organizationId");
CREATE INDEX IF NOT EXISTS "Kri_riskItemId_idx" ON "Kri"("riskItemId");
CREATE INDEX IF NOT EXISTS "Kri_processusId_idx" ON "Kri"("processusId");
CREATE INDEX IF NOT EXISTS "Kri_actif_idx" ON "Kri"("actif");
CREATE INDEX IF NOT EXISTS "KriMesure_kriId_idx" ON "KriMesure"("kriId");
CREATE INDEX IF NOT EXISTS "KriMesure_organizationId_idx" ON "KriMesure"("organizationId");
CREATE INDEX IF NOT EXISTS "KriMesure_dateMesure_idx" ON "KriMesure"("dateMesure");

DO $$ BEGIN
  ALTER TABLE "Kri" ADD CONSTRAINT "Kri_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Kri" ADD CONSTRAINT "Kri_riskItemId_fkey"
    FOREIGN KEY ("riskItemId") REFERENCES "RiskItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "Kri" ADD CONSTRAINT "Kri_processusId_fkey"
    FOREIGN KEY ("processusId") REFERENCES "Processus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "KriMesure" ADD CONSTRAINT "KriMesure_kriId_fkey"
    FOREIGN KEY ("kriId") REFERENCES "Kri"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
