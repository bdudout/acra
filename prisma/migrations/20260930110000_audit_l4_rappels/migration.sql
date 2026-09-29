-- Lot L4 (suite) : rappels automatiques des recommandations et paramétrage de l'audit interne.
ALTER TABLE "OrganizationConfig" ADD COLUMN "auditConfig" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "AuditConstat" ADD COLUMN "rappelLe" TIMESTAMP(3);
