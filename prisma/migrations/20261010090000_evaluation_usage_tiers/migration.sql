-- Lot T1 : évaluation d'un usage de service tiers (méthode atelier 3 EBIOS RM).
-- CreateTable
CREATE TABLE "EvaluationUsageTiers" (
    "id" TEXT NOT NULL,
    "usageId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actuelle" JSONB NOT NULL DEFAULT '{}',
    "cible" JSONB,
    "clauses" JSONB NOT NULL DEFAULT '[]',
    "traitementIds" JSONB NOT NULL DEFAULT '[]',
    "risqueIds" JSONB NOT NULL DEFAULT '[]',
    "justification" TEXT NOT NULL DEFAULT '',
    "statut" TEXT NOT NULL DEFAULT 'BROUILLON',
    "evaluePar" TEXT,
    "soumisLe" TIMESTAMP(3),
    "validePar" TEXT,
    "valideLe" TIMESTAMP(3),
    "rappelLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationUsageTiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationUsageTiers_usageId_key" ON "EvaluationUsageTiers"("usageId");

-- CreateIndex
CREATE INDEX "EvaluationUsageTiers_organizationId_statut_idx" ON "EvaluationUsageTiers"("organizationId", "statut");

-- AddForeignKey
ALTER TABLE "EvaluationUsageTiers" ADD CONSTRAINT "EvaluationUsageTiers_usageId_fkey" FOREIGN KEY ("usageId") REFERENCES "TierServiceUsage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

