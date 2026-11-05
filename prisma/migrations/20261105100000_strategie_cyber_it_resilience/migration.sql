-- Stratégie cyber / IT / résilience (lot S1a) : stratégies, axes, objectifs (identifiants internes facultatifs), rattachements,
-- historique des évolutions après validation ; toggles d'organisation strategieActive / strategieCadreFige.
-- Additive (expand), rejouable (IF NOT EXISTS).
-- AlterTable
ALTER TABLE "OrganizationConfig" ADD COLUMN IF NOT EXISTS "strategieActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "strategieCadreFige" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Strategie" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'CYBER',
    "periodeDebut" TIMESTAMP(3),
    "periodeFin" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'BROUILLON',
    "version" INTEGER NOT NULL DEFAULT 1,
    "versionPrecedenteId" TEXT,
    "valideePar" TEXT,
    "valideeLe" TIMESTAMP(3),
    "cadreValide" JSONB,
    "referenceInterne" TEXT,
    "identifiantsExternes" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Strategie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AxeStrategique" (
    "id" TEXT NOT NULL,
    "strategieId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "referenceRef" TEXT,
    "referenceInterne" TEXT,
    "identifiantsExternes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AxeStrategique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ObjectifStrategique" (
    "id" TEXT NOT NULL,
    "axeId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "indicateur" TEXT,
    "cible" TEXT,
    "echeance" TIMESTAMP(3),
    "kriId" TEXT,
    "referenceInterne" TEXT,
    "identifiantsExternes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObjectifStrategique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RattachementStrategique" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "axeId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "provenance" TEXT NOT NULL DEFAULT 'MANUEL',
    "ajoutePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RattachementStrategique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StrategieEvolution" (
    "id" TEXT NOT NULL,
    "strategieId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cibleId" TEXT,
    "avant" JSONB,
    "apres" JSONB,
    "justification" TEXT NOT NULL,
    "auteurId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategieEvolution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Strategie_organizationId_idx" ON "Strategie"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Strategie_organizationId_statut_idx" ON "Strategie"("organizationId", "statut");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Strategie_versionPrecedenteId_idx" ON "Strategie"("versionPrecedenteId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AxeStrategique_strategieId_idx" ON "AxeStrategique"("strategieId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ObjectifStrategique_axeId_idx" ON "ObjectifStrategique"("axeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RattachementStrategique_organizationId_idx" ON "RattachementStrategique"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RattachementStrategique_organizationId_sourceType_sourceId_idx" ON "RattachementStrategique"("organizationId", "sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RattachementStrategique_axeId_sourceType_sourceId_key" ON "RattachementStrategique"("axeId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StrategieEvolution_strategieId_createdAt_idx" ON "StrategieEvolution"("strategieId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StrategieEvolution_organizationId_idx" ON "StrategieEvolution"("organizationId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Strategie_organizationId_fkey') THEN
    ALTER TABLE "Strategie" ADD CONSTRAINT "Strategie_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Strategie_versionPrecedenteId_fkey') THEN
    ALTER TABLE "Strategie" ADD CONSTRAINT "Strategie_versionPrecedenteId_fkey" FOREIGN KEY ("versionPrecedenteId") REFERENCES "Strategie"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AxeStrategique_strategieId_fkey') THEN
    ALTER TABLE "AxeStrategique" ADD CONSTRAINT "AxeStrategique_strategieId_fkey" FOREIGN KEY ("strategieId") REFERENCES "Strategie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ObjectifStrategique_axeId_fkey') THEN
    ALTER TABLE "ObjectifStrategique" ADD CONSTRAINT "ObjectifStrategique_axeId_fkey" FOREIGN KEY ("axeId") REFERENCES "AxeStrategique"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RattachementStrategique_organizationId_fkey') THEN
    ALTER TABLE "RattachementStrategique" ADD CONSTRAINT "RattachementStrategique_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RattachementStrategique_axeId_fkey') THEN
    ALTER TABLE "RattachementStrategique" ADD CONSTRAINT "RattachementStrategique_axeId_fkey" FOREIGN KEY ("axeId") REFERENCES "AxeStrategique"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StrategieEvolution_strategieId_fkey') THEN
    ALTER TABLE "StrategieEvolution" ADD CONSTRAINT "StrategieEvolution_strategieId_fkey" FOREIGN KEY ("strategieId") REFERENCES "Strategie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StrategieEvolution_organizationId_fkey') THEN
    ALTER TABLE "StrategieEvolution" ADD CONSTRAINT "StrategieEvolution_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

