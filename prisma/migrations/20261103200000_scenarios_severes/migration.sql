-- Scénarios « sévères mais plausibles » des fonctions critiques ou importantes. Ajout d'une table (expand).
CREATE TABLE "ScenarioSevere" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "processusId" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "description" TEXT,
    "dureeInterruptionMinutes" INTEGER NOT NULL,
    "mesures" TEXT,
    "dateEvaluation" DATE,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioSevere_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScenarioSevere_organizationId_processusId_idx" ON "ScenarioSevere"("organizationId", "processusId");

ALTER TABLE "ScenarioSevere" ADD CONSTRAINT "ScenarioSevere_processusId_fkey" FOREIGN KEY ("processusId") REFERENCES "Processus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
