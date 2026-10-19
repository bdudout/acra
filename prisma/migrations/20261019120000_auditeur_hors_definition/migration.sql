-- n° 64 : ligne unique — exclure l'auditeur de la définition des dispositifs (option d'organisation, désactivée par défaut).
ALTER TABLE "OrganizationConfig" ADD COLUMN "auditeurHorsDefinition" BOOLEAN NOT NULL DEFAULT false;
