-- Dernière activité d'une organisation (mode démo, purge par inactivité)
ALTER TABLE "Organization" ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
