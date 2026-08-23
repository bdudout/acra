-- Récurrence d'une campagne de contrôle (planification automatique de la suivante à la clôture)
ALTER TABLE "CampagneControle" ADD COLUMN "recurrence" TEXT NOT NULL DEFAULT 'NONE';
