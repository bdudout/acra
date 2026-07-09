-- Réglages fins du mode démo (surchargent DEMO_DEFAULTS), éditables par le SUPER_ADMIN.
ALTER TABLE "Configuration" ADD COLUMN "demoConfig" JSONB;
