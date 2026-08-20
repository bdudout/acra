-- Bibliothèque documentaire GRC : métadonnées (octets hors base)
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'AUTRE',
    "portee" TEXT NOT NULL DEFAULT 'ORG',
    "referentielCode" TEXT,
    "risqueId" TEXT,
    "version" TEXT,
    "description" TEXT,
    "dateDocument" TIMESTAMP(3),
    "dateRevue" TIMESTAMP(3),
    "fichierNom" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "remplaceId" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Document_organizationId_idx" ON "Document"("organizationId");
CREATE INDEX "Document_organizationId_portee_idx" ON "Document"("organizationId", "portee");
CREATE INDEX "Document_referentielCode_idx" ON "Document"("referentielCode");
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
