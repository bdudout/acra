-- Historique des réorganisations du référentiel des entités (consolidation, lot E4). Migration additive.
-- CreateTable
CREATE TABLE "EntiteEvenement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dateEffet" DATE NOT NULL,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "cibles" JSONB NOT NULL DEFAULT '[]',
    "objets" JSONB NOT NULL DEFAULT '{}',
    "auteurId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntiteEvenement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntiteEvenement_organizationId_dateEffet_idx" ON "EntiteEvenement"("organizationId", "dateEffet");

-- AddForeignKey
ALTER TABLE "EntiteEvenement" ADD CONSTRAINT "EntiteEvenement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

