-- Module M3 : contrôle permanent (bibliothèque + exécutions) + toggle du module
ALTER TABLE "OrganizationConfig" ADD COLUMN IF NOT EXISTS "controlePermanentActive" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "Controle" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "description" TEXT,
    "niveau" TEXT NOT NULL DEFAULT 'N1',
    "periodicite" TEXT NOT NULL DEFAULT 'TRIMESTRIEL',
    "responsable" TEXT,
    "tailleEchantillon" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "riskItemId" TEXT,
    "processusId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Controle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ControleExecution" (
    "id" TEXT NOT NULL,
    "controleId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "resultat" TEXT NOT NULL,
    "dateRealisation" TIMESTAMP(3) NOT NULL,
    "constat" TEXT,
    "tailleTestee" INTEGER,
    "anomaliesTrouvees" INTEGER,
    "executantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ControleExecution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Controle_organizationId_idx" ON "Controle"("organizationId");
CREATE INDEX IF NOT EXISTS "Controle_riskItemId_idx" ON "Controle"("riskItemId");
CREATE INDEX IF NOT EXISTS "Controle_processusId_idx" ON "Controle"("processusId");
CREATE INDEX IF NOT EXISTS "Controle_actif_idx" ON "Controle"("actif");
CREATE INDEX IF NOT EXISTS "ControleExecution_controleId_idx" ON "ControleExecution"("controleId");
CREATE INDEX IF NOT EXISTS "ControleExecution_organizationId_idx" ON "ControleExecution"("organizationId");
CREATE INDEX IF NOT EXISTS "ControleExecution_dateRealisation_idx" ON "ControleExecution"("dateRealisation");

DO $$ BEGIN
  ALTER TABLE "Controle" ADD CONSTRAINT "Controle_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Controle" ADD CONSTRAINT "Controle_riskItemId_fkey"
    FOREIGN KEY ("riskItemId") REFERENCES "RiskItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Controle" ADD CONSTRAINT "Controle_processusId_fkey"
    FOREIGN KEY ("processusId") REFERENCES "Processus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ControleExecution" ADD CONSTRAINT "ControleExecution_controleId_fkey"
    FOREIGN KEY ("controleId") REFERENCES "Controle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
