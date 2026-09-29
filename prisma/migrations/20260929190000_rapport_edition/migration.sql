-- Lot L2 « Reporting » : éditions figées de rapports GRC.
CREATE TABLE "RapportEdition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "periodeDebut" DATE NOT NULL,
    "periodeFin" DATE NOT NULL,
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "statut" TEXT NOT NULL DEFAULT 'BROUILLON',
    "contenu" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "releuPar" TEXT,
    "releuLe" TIMESTAMP(3),
    "validePar" TEXT,
    "valideLe" TIMESTAMP(3),
    "diffuseLe" TIMESTAMP(3),
    "destinataires" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RapportEdition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RapportEdition_organizationId_code_idx" ON "RapportEdition"("organizationId", "code");
CREATE INDEX "RapportEdition_statut_idx" ON "RapportEdition"("statut");
ALTER TABLE "RapportEdition" ADD CONSTRAINT "RapportEdition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
