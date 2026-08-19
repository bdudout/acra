-- Campagne de contrôle de 1er niveau (N1) — orchestration des vagues de contrôles.
CREATE TABLE IF NOT EXISTS "CampagneControle" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "intitule" TEXT NOT NULL,
  "description" TEXT,
  "niveau" TEXT NOT NULL DEFAULT 'N1',
  "statut" TEXT NOT NULL DEFAULT 'PLANIFIEE',
  "dateDebut" TIMESTAMP(3),
  "dateFin" TIMESTAMP(3),
  "controleIds" JSONB NOT NULL DEFAULT '[]',
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampagneControle_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CampagneControle_organizationId_idx" ON "CampagneControle"("organizationId");
DO $$ BEGIN
  ALTER TABLE "CampagneControle" ADD CONSTRAINT "CampagneControle_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
