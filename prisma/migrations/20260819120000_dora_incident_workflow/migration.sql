-- Workflow de déclaration d'incident TIC (DORA art. 19) : horodatages de
-- classification « majeur » et des soumissions par phase. Colonnes nullables.
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "doraClasseMajeurLe" TIMESTAMP(3);
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "doraInitialeSoumiseLe" TIMESTAMP(3);
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "doraIntermediaireSoumiseLe" TIMESTAMP(3);
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "doraFinaleSoumiseLe" TIMESTAMP(3);
