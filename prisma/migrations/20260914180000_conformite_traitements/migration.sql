-- Traitements réels des écarts de conformité (plan d'action / dérogation / acceptation de risque)
CREATE TABLE "ConformiteTraitement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "referentiel" TEXT NOT NULL,
    "entite" TEXT NOT NULL DEFAULT '',
    "refs" JSONB NOT NULL DEFAULT '[]',
    "type" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "description" TEXT,
    "responsable" TEXT,
    "echeance" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'EN_COURS',
    "niveauRisqueMaintenu" BOOLEAN NOT NULL DEFAULT false,
    "niveauRisque" TEXT,
    "derogationId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConformiteTraitement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConformiteTraitement_organizationId_referentiel_entite_idx" ON "ConformiteTraitement"("organizationId", "referentiel", "entite");
CREATE INDEX "ConformiteTraitement_type_idx" ON "ConformiteTraitement"("type");
CREATE INDEX "ConformiteTraitement_derogationId_idx" ON "ConformiteTraitement"("derogationId");

ALTER TABLE "ConformiteTraitement" ADD CONSTRAINT "ConformiteTraitement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConformiteTraitement" ADD CONSTRAINT "ConformiteTraitement_derogationId_fkey" FOREIGN KEY ("derogationId") REFERENCES "Derogation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
