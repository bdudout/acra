-- Chantier B : catégorie (taxonomie) sur les risques d'analyse → appétit par catégorie.
ALTER TABLE "Risque" ADD COLUMN "taxonomieCode" TEXT;

-- Chantier A : archivage + rapports/preuves sur les missions de contrôle/audit.
ALTER TABLE "AuditMission" ADD COLUMN "archiveLe" TIMESTAMP(3);
ALTER TABLE "AuditMission" ADD COLUMN "rapports" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "CampagneControle" ADD COLUMN "archiveLe" TIMESTAMP(3);
ALTER TABLE "CampagneControle" ADD COLUMN "rapports" JSONB NOT NULL DEFAULT '[]';

-- Durée de conservation avant archivage (années, défaut 5).
ALTER TABLE "OrganizationConfig" ADD COLUMN "archivageMissionsAnnees" INTEGER NOT NULL DEFAULT 5;
