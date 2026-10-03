-- Modules optionnels (désactivés par défaut) : homologations, revues d'habilitations, registre IA.
ALTER TABLE "OrganizationConfig" ADD COLUMN "homologationsActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrganizationConfig" ADD COLUMN "recertificationActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrganizationConfig" ADD COLUMN "registreIaActive" BOOLEAN NOT NULL DEFAULT false;
