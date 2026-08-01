-- M3 : pièces justificatives des exécutions + anti-doublon d'alerte d'échéance
ALTER TABLE "ControleExecution" ADD COLUMN IF NOT EXISTS "preuves" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Controle" ADD COLUMN IF NOT EXISTS "alerteeLe" TIMESTAMP(3);
