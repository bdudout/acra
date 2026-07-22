-- AuditLog.organizationId : scoping des logs par organisation (dette #4)
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- Backfill (best-effort) : rattache chaque ligne existante à la 1re appartenance de son auteur.
UPDATE "AuditLog" a
SET "organizationId" = m."organizationId"
FROM (
  SELECT DISTINCT ON ("userId") "userId", "organizationId"
  FROM "OrgMembership" ORDER BY "userId", "createdAt"
) m
WHERE a."userId" = m."userId" AND a."organizationId" IS NULL;
