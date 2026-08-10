-- M1 v2 : campagnes d'évaluation RCSA (campagne + évaluation par risque)
CREATE TABLE IF NOT EXISTS "Campagne" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "description" TEXT,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'BROUILLON',
    "ouvertePar" TEXT,
    "ouverteLe" TIMESTAMP(3),
    "clotureePar" TEXT,
    "clotureeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Campagne_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CampagneEvaluation" (
    "id" TEXT NOT NULL,
    "campagneId" TEXT NOT NULL,
    "riskItemId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "origineGraviteInherente" INTEGER,
    "origineVraisemblanceInherente" INTEGER,
    "origineGraviteResiduelle" INTEGER,
    "origineVraisemblanceResiduelle" INTEGER,
    "graviteInherente" INTEGER,
    "vraisemblanceInherente" INTEGER,
    "efficaciteControles" TEXT,
    "graviteResiduelle" INTEGER,
    "vraisemblanceResiduelle" INTEGER,
    "commentaire" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'A_COTER',
    "evaluateurId" TEXT,
    "coteeLe" TIMESTAMP(3),
    "valideurId" TEXT,
    "valideeLe" TIMESTAMP(3),
    "motifRejet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CampagneEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Campagne_organizationId_idx" ON "Campagne"("organizationId");
CREATE INDEX IF NOT EXISTS "Campagne_statut_idx" ON "Campagne"("statut");
CREATE UNIQUE INDEX IF NOT EXISTS "CampagneEvaluation_campagneId_riskItemId_key" ON "CampagneEvaluation"("campagneId", "riskItemId");
CREATE INDEX IF NOT EXISTS "CampagneEvaluation_campagneId_idx" ON "CampagneEvaluation"("campagneId");
CREATE INDEX IF NOT EXISTS "CampagneEvaluation_riskItemId_idx" ON "CampagneEvaluation"("riskItemId");
CREATE INDEX IF NOT EXISTS "CampagneEvaluation_organizationId_idx" ON "CampagneEvaluation"("organizationId");
CREATE INDEX IF NOT EXISTS "CampagneEvaluation_statut_idx" ON "CampagneEvaluation"("statut");

DO $$ BEGIN
  ALTER TABLE "Campagne" ADD CONSTRAINT "Campagne_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CampagneEvaluation" ADD CONSTRAINT "CampagneEvaluation_campagneId_fkey"
    FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CampagneEvaluation" ADD CONSTRAINT "CampagneEvaluation_riskItemId_fkey"
    FOREIGN KEY ("riskItemId") REFERENCES "RiskItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
