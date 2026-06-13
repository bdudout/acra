-- Indexes sur les clés étrangères et colonnes de filtrage fréquent
-- PostgreSQL ne crée pas d'index automatiquement sur les FK

-- Analyse
CREATE INDEX IF NOT EXISTS "Analyse_userId_idx"  ON "Analyse"("userId");
CREATE INDEX IF NOT EXISTS "Analyse_statut_idx"  ON "Analyse"("statut");
CREATE INDEX IF NOT EXISTS "Analyse_socleId_idx" ON "Analyse"("socleId");

-- SourceRisque
CREATE INDEX IF NOT EXISTS "SourceRisque_analyseId_idx" ON "SourceRisque"("analyseId");

-- PartiePrenante
CREATE INDEX IF NOT EXISTS "PartiePrenante_analyseId_idx" ON "PartiePrenante"("analyseId");

-- ScenarioStrategique
CREATE INDEX IF NOT EXISTS "ScenarioStrategique_analyseId_idx"     ON "ScenarioStrategique"("analyseId");
CREATE INDEX IF NOT EXISTS "ScenarioStrategique_sourceRisqueId_idx" ON "ScenarioStrategique"("sourceRisqueId");

-- ScenarioOperationnel
CREATE INDEX IF NOT EXISTS "ScenarioOperationnel_analyseId_idx"             ON "ScenarioOperationnel"("analyseId");
CREATE INDEX IF NOT EXISTS "ScenarioOperationnel_scenarioStrategiqueId_idx" ON "ScenarioOperationnel"("scenarioStrategiqueId");

-- Risque
CREATE INDEX IF NOT EXISTS "Risque_analyseId_idx"    ON "Risque"("analyseId");
CREATE INDEX IF NOT EXISTS "Risque_niveauRisque_idx" ON "Risque"("niveauRisque");

-- Mesure
CREATE INDEX IF NOT EXISTS "Mesure_analyseId_idx" ON "Mesure"("analyseId");
CREATE INDEX IF NOT EXISTS "Mesure_statut_idx"    ON "Mesure"("statut");
CREATE INDEX IF NOT EXISTS "Mesure_priorite_idx"  ON "Mesure"("priorite");
