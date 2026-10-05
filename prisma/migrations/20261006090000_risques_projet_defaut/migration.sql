-- Risques présents par défaut dans tout projet 360, configurables par organisation (additif, null = hérité).
ALTER TABLE "OrganizationConfig" ADD COLUMN "risquesProjetDefaut" JSONB;
