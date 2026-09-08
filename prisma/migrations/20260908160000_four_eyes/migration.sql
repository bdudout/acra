-- Four-eyes : interdiction d'auto-approbation (auteur ≠ approbateur), activée par défaut
ALTER TABLE "OrganizationConfig" ADD COLUMN "interdireAutoApprobation" BOOLEAN NOT NULL DEFAULT true;
