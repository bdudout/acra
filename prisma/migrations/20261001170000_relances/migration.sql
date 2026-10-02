-- Relances automatiques : questionnaires, préconisations et plans d'action.
ALTER TABLE "OrganizationConfig" ADD COLUMN "relancesConfig" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "PlanAction" ADD COLUMN "rappelLe" TIMESTAMP(3);
ALTER TABLE "QuestionnaireReponse" ADD COLUMN "rappelLe" TIMESTAMP(3);
ALTER TABLE "Preconisation" ADD COLUMN "rappelLe" TIMESTAMP(3);
