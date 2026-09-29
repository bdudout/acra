-- Lot L1 « Incidents & pertes » : régimes de notification, pertes multi-composantes, types d'événement.
ALTER TABLE "OrganizationConfig" ADD COLUMN "incidentsConfig" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Incident" ADD COLUMN "typeEvenement" TEXT;
ALTER TABLE "Incident" ADD COLUMN "quasiIncident" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Incident" ADD COLUMN "attributs" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Incident" ADD COLUMN "notifications" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Incident" ADD COLUMN "pertes" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Incident" ADD COLUMN "recuperationsLignes" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Incident" ADD COLUMN "dateReglement" TIMESTAMP(3);
