-- Homologation de sécurité des systèmes d'information (module optionnel « Homologations »).
CREATE TABLE "Homologation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "analyseId" TEXT,
    "systeme" TEXT NOT NULL,
    "perimetre" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'PREPARATION',
    "preparePar" TEXT NOT NULL,
    "autoriteId" TEXT,
    "dureeMois" INTEGER NOT NULL DEFAULT 36,
    "dateDecision" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "decidePar" TEXT,
    "commentaireDecision" TEXT,
    "reserves" JSONB NOT NULL DEFAULT '[]',
    "pieces" JSONB NOT NULL DEFAULT '[]',
    "rappelLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Homologation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Homologation_organizationId_statut_idx" ON "Homologation"("organizationId", "statut");
CREATE INDEX "Homologation_analyseId_idx" ON "Homologation"("analyseId");
CREATE INDEX "Homologation_dateFin_idx" ON "Homologation"("dateFin");
ALTER TABLE "Homologation" ADD CONSTRAINT "Homologation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Homologation" ADD CONSTRAINT "Homologation_analyseId_fkey" FOREIGN KEY ("analyseId") REFERENCES "Analyse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
