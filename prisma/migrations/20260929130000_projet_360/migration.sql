-- Analyse « projet 360 » (méthode PROJET_360) : domaine des risques, import tracé
-- depuis une analyse cyber, double approbation RSSI + Risk Manager.
ALTER TABLE "Risque" ADD COLUMN "domaine" TEXT;
ALTER TABLE "Risque" ADD COLUMN "sourceRisqueId" TEXT;
ALTER TABLE "Risque" ADD COLUMN "sourceAnalyseId" TEXT;
CREATE UNIQUE INDEX "Risque_analyseId_sourceRisqueId_key" ON "Risque"("analyseId", "sourceRisqueId");

ALTER TABLE "Analyse" ADD COLUMN "approbations" JSONB NOT NULL DEFAULT '[]';
