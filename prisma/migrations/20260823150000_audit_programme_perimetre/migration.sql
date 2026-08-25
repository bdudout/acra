-- Audit N3 : programme d'audit (checklist coté) + périmètre audité (processus / contrôles)
ALTER TABLE "AuditMission" ADD COLUMN "programme" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "AuditMission" ADD COLUMN "programmeResultats" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "AuditMission" ADD COLUMN "processusIds" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "AuditMission" ADD COLUMN "controleIds" JSONB NOT NULL DEFAULT '[]';
