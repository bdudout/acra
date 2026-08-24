-- Contrôle du contrôle (N2→N1) + indépendance de l'exécutant
ALTER TABLE "Controle" ADD COLUMN "superviseIds" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ControleExecution" ADD COLUMN "independant" BOOLEAN;
