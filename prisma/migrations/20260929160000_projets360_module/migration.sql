-- Module « Projets 360 » (onglet Projets), activé par défaut.
ALTER TABLE "OrganizationConfig" ADD COLUMN "projets360Active" BOOLEAN NOT NULL DEFAULT true;
