-- Règle de qualification à l'origine d'un risque (risques proposés / imposés).
-- Unique par analyse (NULL autorisé plusieurs fois) : idempotence analyse × règle.
ALTER TABLE "Risque" ADD COLUMN "qualificationRuleId" TEXT;
CREATE UNIQUE INDEX "Risque_analyseId_qualificationRuleId_key" ON "Risque"("analyseId", "qualificationRuleId");
