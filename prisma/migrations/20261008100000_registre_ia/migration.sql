-- CreateTable
CREATE TABLE "SystemeIA" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "finalite" TEXT NOT NULL,
    "fournisseur" TEXT,
    "donnees" JSONB NOT NULL DEFAULT '[]',
    "categoriesParticulieres" BOOLEAN NOT NULL DEFAULT false,
    "typeDecision" TEXT NOT NULL DEFAULT 'AIDE',
    "interventionHumaine" TEXT,
    "usage" TEXT NOT NULL DEFAULT 'AUTRE',
    "controlesBiais" TEXT,
    "derniereRevue" TIMESTAMP(3),
    "analyseId" TEXT,
    "aipdReference" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EN_PROJET',
    "catalogueKey" TEXT,
    "catalogueVersion" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemeIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemeIA_organizationId_idx" ON "SystemeIA"("organizationId");

-- CreateIndex
CREATE INDEX "SystemeIA_analyseId_idx" ON "SystemeIA"("analyseId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemeIA_organizationId_catalogueKey_key" ON "SystemeIA"("organizationId", "catalogueKey");

-- AddForeignKey
ALTER TABLE "SystemeIA" ADD CONSTRAINT "SystemeIA_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemeIA" ADD CONSTRAINT "SystemeIA_analyseId_fkey" FOREIGN KEY ("analyseId") REFERENCES "Analyse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

