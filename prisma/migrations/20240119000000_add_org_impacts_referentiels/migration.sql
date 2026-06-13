-- Types d'impacts + référentiels configurables (singleton OrganizationConfig)
ALTER TABLE "OrganizationConfig" ADD COLUMN "typesImpacts" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "OrganizationConfig" ADD COLUMN "referentielsActifs" JSONB NOT NULL DEFAULT '[]';
