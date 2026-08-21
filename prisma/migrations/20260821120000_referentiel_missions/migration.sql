-- Missions (objectifs de sécurité) sur les référentiels/politiques
ALTER TABLE "Referentiel" ADD COLUMN "missions" JSONB NOT NULL DEFAULT '[]';
