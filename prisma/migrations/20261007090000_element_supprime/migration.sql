-- Corbeille des éléments supprimés (incidents) : instantané restaurable (additif).
CREATE TABLE "ElementSupprime" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "objetId" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "donnees" JSONB NOT NULL,
    "supprimeParId" TEXT,
    "supprimeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ElementSupprime_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ElementSupprime_organizationId_idx" ON "ElementSupprime"("organizationId");
CREATE INDEX "ElementSupprime_supprimeLe_idx" ON "ElementSupprime"("supprimeLe");
