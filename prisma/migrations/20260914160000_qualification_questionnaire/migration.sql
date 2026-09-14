-- Personnalisation du questionnaire de qualification par organisation.
ALTER TABLE "OrganizationConfig" ADD COLUMN "qualificationQuestionnaire" JSONB NOT NULL DEFAULT '{}';
