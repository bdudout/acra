-- Double validation (quatre yeux) activable par organisation : option (désactivée par défaut) et file des demandes.
-- Ajouts uniquement (expand) : aucune donnée existante modifiée.
ALTER TABLE "OrganizationConfig" ADD COLUMN "doubleValidationActive" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "DemandeValidation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cibleId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "demandeurId" TEXT NOT NULL,
    "valideurId" TEXT,
    "motifDecision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decideLe" TIMESTAMP(3),

    CONSTRAINT "DemandeValidation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DemandeValidation_organizationId_statut_idx" ON "DemandeValidation"("organizationId", "statut");
CREATE INDEX "DemandeValidation_type_cibleId_statut_idx" ON "DemandeValidation"("type", "cibleId", "statut");
