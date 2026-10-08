-- Référentiel des entités (consolidation, lot E1 — docs/specs/entites-consolidation-besoin.md). Migration additive :
-- nouvelle table Entite et lien optionnel entiteId à côté des champs texte « entite » existants (conservés).
-- AlterTable
ALTER TABLE "RiskItem" ADD COLUMN     "entiteId" TEXT;

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "entiteId" TEXT;

-- AlterTable
ALTER TABLE "Conformite" ADD COLUMN     "entiteId" TEXT;

-- AlterTable
ALTER TABLE "PlanAction" ADD COLUMN     "entiteId" TEXT;

-- AlterTable
ALTER TABLE "ConformiteTraitement" ADD COLUMN     "entiteId" TEXT;

-- AlterTable
ALTER TABLE "Mesure" ADD COLUMN     "entiteId" TEXT;

-- CreateTable
CREATE TABLE "Entite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "codeExterne" TEXT,
    "alias" JSONB NOT NULL DEFAULT '[]',
    "parentId" TEXT,
    "organisationLieeId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUEL',
    "valideDu" DATE,
    "valideAu" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Entite_organizationId_idx" ON "Entite"("organizationId");

-- CreateIndex
CREATE INDEX "Entite_parentId_idx" ON "Entite"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Entite_organizationId_codeExterne_key" ON "Entite"("organizationId", "codeExterne");

-- CreateIndex
CREATE INDEX "RiskItem_entiteId_idx" ON "RiskItem"("entiteId");

-- CreateIndex
CREATE INDEX "Incident_entiteId_idx" ON "Incident"("entiteId");

-- CreateIndex
CREATE INDEX "Conformite_entiteId_idx" ON "Conformite"("entiteId");

-- CreateIndex
CREATE INDEX "PlanAction_entiteId_idx" ON "PlanAction"("entiteId");

-- CreateIndex
CREATE INDEX "ConformiteTraitement_entiteId_idx" ON "ConformiteTraitement"("entiteId");

-- CreateIndex
CREATE INDEX "Mesure_entiteId_idx" ON "Mesure"("entiteId");

-- AddForeignKey
ALTER TABLE "RiskItem" ADD CONSTRAINT "RiskItem_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conformite" ADD CONSTRAINT "Conformite_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAction" ADD CONSTRAINT "PlanAction_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConformiteTraitement" ADD CONSTRAINT "ConformiteTraitement_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mesure" ADD CONSTRAINT "Mesure_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entite" ADD CONSTRAINT "Entite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entite" ADD CONSTRAINT "Entite_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Entite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entite" ADD CONSTRAINT "Entite_organisationLieeId_fkey" FOREIGN KEY ("organisationLieeId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

