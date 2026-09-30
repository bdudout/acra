-- Modèle additif : aucun backfill ni rapprochement automatique par nom.
CREATE TYPE "TierBeneficiaryStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'REJECTED');

ALTER TABLE "ArrangementTic" ADD COLUMN "tierId" TEXT;
ALTER TABLE "PartiePrenante" ADD COLUMN "tierId" TEXT;

CREATE TABLE "Tier" (
    "id" TEXT NOT NULL,
    "rootOrganizationId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "lei" TEXT,
    "pays" TEXT,
    "aliases" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TierOrganization" (
    "tierId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TierOrganization_pkey" PRIMARY KEY ("tierId", "organizationId")
);

CREATE TABLE "TierService" (
    "id" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "typeService" TEXT NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TierService_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TierContractService" (
    "id" TEXT NOT NULL,
    "arrangementId" TEXT NOT NULL,
    "tierServiceId" TEXT NOT NULL,
    CONSTRAINT "TierContractService_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TierContractBeneficiary" (
    "arrangementId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "TierBeneficiaryStatus" NOT NULL DEFAULT 'PROPOSED',
    "proposedById" TEXT,
    "confirmedById" TEXT,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    CONSTRAINT "TierContractBeneficiary_pkey" PRIMARY KEY ("arrangementId", "organizationId")
);

CREATE TABLE "TierServiceUsage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tierServiceId" TEXT NOT NULL,
    "processusId" TEXT,
    "contractServiceId" TEXT,
    "useCase" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TierServiceUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ArrangementTic_tierId_idx" ON "ArrangementTic"("tierId");
CREATE INDEX "PartiePrenante_tierId_idx" ON "PartiePrenante"("tierId");
CREATE INDEX "Tier_rootOrganizationId_idx" ON "Tier"("rootOrganizationId");
CREATE INDEX "Tier_lei_idx" ON "Tier"("lei");
CREATE INDEX "TierOrganization_organizationId_idx" ON "TierOrganization"("organizationId");
CREATE INDEX "TierService_tierId_idx" ON "TierService"("tierId");
CREATE UNIQUE INDEX "TierContractService_arrangementId_tierServiceId_key" ON "TierContractService"("arrangementId", "tierServiceId");
CREATE INDEX "TierContractService_tierServiceId_idx" ON "TierContractService"("tierServiceId");
CREATE INDEX "TierContractBeneficiary_organizationId_status_idx" ON "TierContractBeneficiary"("organizationId", "status");
CREATE INDEX "TierServiceUsage_organizationId_tierServiceId_idx" ON "TierServiceUsage"("organizationId", "tierServiceId");
CREATE INDEX "TierServiceUsage_processusId_idx" ON "TierServiceUsage"("processusId");
CREATE INDEX "TierServiceUsage_contractServiceId_idx" ON "TierServiceUsage"("contractServiceId");

ALTER TABLE "ArrangementTic" ADD CONSTRAINT "ArrangementTic_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "Tier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartiePrenante" ADD CONSTRAINT "PartiePrenante_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "Tier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Tier" ADD CONSTRAINT "Tier_rootOrganizationId_fkey" FOREIGN KEY ("rootOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TierOrganization" ADD CONSTRAINT "TierOrganization_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "Tier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TierOrganization" ADD CONSTRAINT "TierOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TierService" ADD CONSTRAINT "TierService_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "Tier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TierContractService" ADD CONSTRAINT "TierContractService_arrangementId_fkey" FOREIGN KEY ("arrangementId") REFERENCES "ArrangementTic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TierContractService" ADD CONSTRAINT "TierContractService_tierServiceId_fkey" FOREIGN KEY ("tierServiceId") REFERENCES "TierService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TierContractBeneficiary" ADD CONSTRAINT "TierContractBeneficiary_arrangementId_fkey" FOREIGN KEY ("arrangementId") REFERENCES "ArrangementTic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TierContractBeneficiary" ADD CONSTRAINT "TierContractBeneficiary_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TierServiceUsage" ADD CONSTRAINT "TierServiceUsage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TierServiceUsage" ADD CONSTRAINT "TierServiceUsage_tierServiceId_fkey" FOREIGN KEY ("tierServiceId") REFERENCES "TierService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TierServiceUsage" ADD CONSTRAINT "TierServiceUsage_processusId_fkey" FOREIGN KEY ("processusId") REFERENCES "Processus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TierServiceUsage" ADD CONSTRAINT "TierServiceUsage_contractServiceId_fkey" FOREIGN KEY ("contractServiceId") REFERENCES "TierContractService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
