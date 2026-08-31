-- Registre des activités de traitement (RoPA — RGPD art. 30)
CREATE TABLE "Traitement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "finalite" TEXT NOT NULL,
    "baseLegale" TEXT NOT NULL DEFAULT '',
    "categoriesPersonnes" JSONB NOT NULL DEFAULT '[]',
    "categoriesDonnees" JSONB NOT NULL DEFAULT '[]',
    "destinataires" JSONB NOT NULL DEFAULT '[]',
    "transfertHorsUE" BOOLEAN NOT NULL DEFAULT false,
    "paysTransfert" TEXT,
    "garantiesTransfert" TEXT,
    "dureeConservation" TEXT NOT NULL DEFAULT '',
    "mesuresSecurite" JSONB NOT NULL DEFAULT '[]',
    "grandeEchelle" BOOLEAN NOT NULL DEFAULT false,
    "surveillanceSystematique" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Traitement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Traitement_organizationId_idx" ON "Traitement"("organizationId");
ALTER TABLE "Traitement" ADD CONSTRAINT "Traitement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
