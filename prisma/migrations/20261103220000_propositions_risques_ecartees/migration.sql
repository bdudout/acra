-- Risques proposés écartés (lot L4) : mémorise la clé `TYPE:idOrigine` d'une proposition écartée. Table nouvelle (expand), rétrocompatible.
CREATE TABLE "PropositionRisqueEcartee" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "ecartePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropositionRisqueEcartee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PropositionRisqueEcartee_organizationId_cle_key" ON "PropositionRisqueEcartee"("organizationId", "cle");

ALTER TABLE "PropositionRisqueEcartee" ADD CONSTRAINT "PropositionRisqueEcartee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un seul risque par proposition validée (double validation concurrente → P2002 → 409). Index PARTIEL : les autres
-- provenances (analyse, incident…) ne sont pas contraintes. Non exprimable dans schema.prisma (cf. commentaire RiskItem).
CREATE UNIQUE INDEX "RiskItem_proposition_tic_sourceId_key" ON "RiskItem"("organizationId", "sourceId") WHERE "sourceType" = 'proposition-tic';
