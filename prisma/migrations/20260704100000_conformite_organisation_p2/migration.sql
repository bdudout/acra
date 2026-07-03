-- AlterTable
ALTER TABLE "OrganizationConfig" ADD COLUMN     "conformiteNiveau" TEXT NOT NULL DEFAULT 'ANALYSE',
ADD COLUMN     "conformiteSnapshotMode" TEXT NOT NULL DEFAULT 'MANUEL';

-- CreateTable
CREATE TABLE "Conformite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "referentiel" TEXT NOT NULL,
    "entries" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conformite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConformiteSnapshot" (
    "id" TEXT NOT NULL,
    "conformiteId" TEXT NOT NULL,
    "entries" JSONB NOT NULL,
    "label" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConformiteSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conformite_organizationId_idx" ON "Conformite"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Conformite_organizationId_referentiel_key" ON "Conformite"("organizationId", "referentiel");

-- CreateIndex
CREATE INDEX "ConformiteSnapshot_conformiteId_idx" ON "ConformiteSnapshot"("conformiteId");

-- AddForeignKey
ALTER TABLE "Conformite" ADD CONSTRAINT "Conformite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConformiteSnapshot" ADD CONSTRAINT "ConformiteSnapshot_conformiteId_fkey" FOREIGN KEY ("conformiteId") REFERENCES "Conformite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

