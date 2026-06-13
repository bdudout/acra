-- Migration: add MFA configuration fields to PasswordPolicy
-- Authentification forte (MFA) par email et/ou SMS — désactivée par défaut

ALTER TABLE "PasswordPolicy"
  ADD COLUMN IF NOT EXISTS "mfaEnabled"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mfaMethodEmail" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "mfaMethodSms"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mfaScope"       TEXT    NOT NULL DEFAULT 'ALL',
  ADD COLUMN IF NOT EXISTS "smsProvider"    TEXT    NOT NULL DEFAULT 'TWILIO',
  ADD COLUMN IF NOT EXISTS "smsApiKey"      TEXT,
  ADD COLUMN IF NOT EXISTS "smsApiSecret"   TEXT,
  ADD COLUMN IF NOT EXISTS "smsSenderId"    TEXT;
