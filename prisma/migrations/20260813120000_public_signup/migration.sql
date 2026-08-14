-- Inscription publique en self-service, réglée au runtime par le SUPER_ADMIN.
ALTER TABLE "Configuration" ADD COLUMN IF NOT EXISTS "publicSignupActive" BOOLEAN NOT NULL DEFAULT false;
