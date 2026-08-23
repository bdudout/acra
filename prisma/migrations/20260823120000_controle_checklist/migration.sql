-- Checklist (points à vérifier) sur un contrôle + cotation par point à l'exécution
ALTER TABLE "Controle" ADD COLUMN "checklist" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ControleExecution" ADD COLUMN "checklistResultats" JSONB NOT NULL DEFAULT '[]';
