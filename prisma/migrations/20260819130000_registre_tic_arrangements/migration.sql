-- Registre d'information des prestataires tiers TIC (DORA art. 28).
CREATE TABLE IF NOT EXISTS "ArrangementTic" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "prestataireNom" TEXT NOT NULL,
  "identifiant" TEXT,
  "pays" TEXT,
  "typeService" TEXT NOT NULL DEFAULT 'AUTRE',
  "fonctionSupportee" TEXT,
  "criticite" TEXT NOT NULL DEFAULT 'NON_CRITIQUE',
  "dateDebut" TIMESTAMP(3),
  "dateFin" TIMESTAMP(3),
  "paysDonnees" TEXT,
  "sousTraitance" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ArrangementTic_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ArrangementTic_organizationId_idx" ON "ArrangementTic"("organizationId");
DO $$ BEGIN
  ALTER TABLE "ArrangementTic" ADD CONSTRAINT "ArrangementTic_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
