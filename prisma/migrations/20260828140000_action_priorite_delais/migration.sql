-- Priorité d'action (échéance par défaut) + délais configurables par organisation
ALTER TABLE "RiskAction" ADD COLUMN "priorite" TEXT NOT NULL DEFAULT 'MAJEUR';
ALTER TABLE "OrganizationConfig" ADD COLUMN "actionDelaisMois" JSONB NOT NULL DEFAULT '{"CRITIQUE":6,"MAJEUR":12,"MODERE":24}';
