-- Lot L5 : champs personnalisés sur les constats d'audit.
ALTER TABLE "AuditConstat" ADD COLUMN "champs" JSONB NOT NULL DEFAULT '{}';
