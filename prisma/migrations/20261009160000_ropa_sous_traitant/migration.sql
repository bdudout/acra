-- Registre du sous-traitant (RGPD art. 30 §2) : module activable (désactivé par défaut) et table des traitements effectués
-- pour le compte de clients. Migration additive.
-- AlterTable
ALTER TABLE "OrganizationConfig" ADD COLUMN     "ropaSousTraitantActive" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TraitementSousTraitance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientNom" TEXT NOT NULL,
    "clientContact" TEXT NOT NULL DEFAULT '',
    "clientDpo" TEXT NOT NULL DEFAULT '',
    "categoriesTraitements" JSONB NOT NULL DEFAULT '[]',
    "transfertHorsUE" BOOLEAN NOT NULL DEFAULT false,
    "paysTransfert" TEXT NOT NULL DEFAULT '',
    "garantiesTransfert" TEXT NOT NULL DEFAULT '',
    "mesuresSecurite" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraitementSousTraitance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TraitementSousTraitance_organizationId_idx" ON "TraitementSousTraitance"("organizationId");

-- AddForeignKey
ALTER TABLE "TraitementSousTraitance" ADD CONSTRAINT "TraitementSousTraitance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

