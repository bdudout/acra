-- Migration: ajout missions, scores SR/OV, traçabilité, Configuration

-- Atelier 1 : missions de l'organisation
ALTER TABLE "Cadrage" ADD COLUMN IF NOT EXISTS "missions" TEXT;

-- Atelier 2 : caractérisation FM4 des sources de risque
ALTER TABLE "SourceRisque" ADD COLUMN IF NOT EXISTS "activite" TEXT;
ALTER TABLE "SourceRisque" ADD COLUMN IF NOT EXISTS "motivationScore" INTEGER;
ALTER TABLE "SourceRisque" ADD COLUMN IF NOT EXISTS "ressourcesScore" INTEGER;
ALTER TABLE "SourceRisque" ADD COLUMN IF NOT EXISTS "activiteScore" INTEGER;

-- Atelier 3 : traçabilité ER + mesures écosystème dans scénarios stratégiques
ALTER TABLE "ScenarioStrategique" ADD COLUMN IF NOT EXISTS "evenementRedouteRef" TEXT;
ALTER TABLE "ScenarioStrategique" ADD COLUMN IF NOT EXISTS "mesuresEcosysteme" JSONB;

-- Atelier 5 : fiche risque résiduel structurée
ALTER TABLE "Risque" ADD COLUMN IF NOT EXISTS "evenementRedouteRef" TEXT;
ALTER TABLE "Risque" ADD COLUMN IF NOT EXISTS "vulnerabilitesResiduelles" JSONB;
ALTER TABLE "Risque" ADD COLUMN IF NOT EXISTS "facteursAggravants" JSONB;
ALTER TABLE "Risque" ADD COLUMN IF NOT EXISTS "justificationResiduelle" TEXT;

-- Configuration utilisateur (échelles et matrices configurables)
CREATE TABLE IF NOT EXISTS "Configuration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nbNiveaux" INTEGER NOT NULL DEFAULT 4,
    "echelleGravite" JSONB NOT NULL,
    "echelleVraisemblance" JSONB NOT NULL,
    "seuilsMatrice" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Configuration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Configuration_userId_key" ON "Configuration"("userId");
ALTER TABLE "Configuration" ADD CONSTRAINT "Configuration_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
