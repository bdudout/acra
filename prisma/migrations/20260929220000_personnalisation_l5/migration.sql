-- Lot L5 « Personnalisation » : vocabulaire, champs personnalisés (définitions par organisation, valeurs par objet).
ALTER TABLE "OrganizationConfig" ADD COLUMN "vocabulaire" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "OrganizationConfig" ADD COLUMN "champsPersonnalises" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Incident" ADD COLUMN "champs" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Controle" ADD COLUMN "champs" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "AuditMission" ADD COLUMN "champs" JSONB NOT NULL DEFAULT '{}';
