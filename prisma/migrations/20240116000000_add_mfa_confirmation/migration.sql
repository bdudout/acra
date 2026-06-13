-- Migration: add MFA confirmation safety window to PasswordPolicy
-- Quand le MFA est activé, une fenêtre de 60 min s'ouvre pour validation.
-- Si aucun admin ne confirme, le MFA est automatiquement désactivé.

ALTER TABLE "PasswordPolicy"
  ADD COLUMN IF NOT EXISTS "mfaPendingConfirmation"  BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mfaConfirmationDeadline" TIMESTAMP;
