-- Questionnaire de qualification risque/sécurité (due diligence DORA art. 28) sur les arrangements TIC.
ALTER TABLE "ArrangementTic" ADD COLUMN "questionnaire" JSONB NOT NULL DEFAULT '[]';
