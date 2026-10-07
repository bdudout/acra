-- Nettoyage du cache sans impact : réglages d'instance (additif).
ALTER TABLE "Configuration" ADD COLUMN "autoCleanup" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Configuration" ADD COLUMN "cleanupCategories" JSONB;
ALTER TABLE "Configuration" ADD COLUMN "lastCleanupAt" TIMESTAMP(3);
ALTER TABLE "Configuration" ADD COLUMN "lastCleanupCounts" JSONB;
ALTER TABLE "Configuration" ADD COLUMN "cleanupLockUntil" TIMESTAMP(3);
