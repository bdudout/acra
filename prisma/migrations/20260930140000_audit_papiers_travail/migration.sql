-- Lot L4 (suite) : papiers de travail des missions d'audit.
ALTER TABLE "AuditMission" ADD COLUMN "papiers" JSONB NOT NULL DEFAULT '[]';
