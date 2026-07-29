-- Socle GRC M2 : plan d'action / traitement d'un RiskItem (RiskAction)
CREATE TABLE IF NOT EXISTS "RiskAction" (
    "id" TEXT NOT NULL,
    "riskItemId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "description" TEXT,
    "responsable" TEXT,
    "echeance" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'A_FAIRE',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RiskAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RiskAction_riskItemId_idx" ON "RiskAction"("riskItemId");
CREATE INDEX IF NOT EXISTS "RiskAction_organizationId_idx" ON "RiskAction"("organizationId");
CREATE INDEX IF NOT EXISTS "RiskAction_statut_idx" ON "RiskAction"("statut");

DO $$ BEGIN
  ALTER TABLE "RiskAction" ADD CONSTRAINT "RiskAction_riskItemId_fkey"
    FOREIGN KEY ("riskItemId") REFERENCES "RiskItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RiskAction" ADD CONSTRAINT "RiskAction_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
