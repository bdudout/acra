-- Migration: fix password policy defaults + add requireEmailVerification
-- Conformité ANSSI guide d'hygiène v2 : 12 car. min, complexité complète, 90j, 5 tentatives

-- 1. Ajouter la colonne requireEmailVerification
ALTER TABLE "PasswordPolicy" ADD COLUMN IF NOT EXISTS "requireEmailVerification" BOOLEAN NOT NULL DEFAULT false;

-- 2. Mettre à jour les defaults Prisma schema (n'affecte que les nouvelles lignes)
--    Les valeurs existantes dans la DB sont conservées ; l'admin peut les modifier via l'UI.
--    Pour forcer la mise à niveau de la politique globale vers l'état de l'art ANSSI :
UPDATE "PasswordPolicy"
SET
  "minLength"        = 12,
  "requireUppercase" = true,
  "requireLowercase" = true,
  "requireNumbers"   = true,
  "requireSpecial"   = true,
  "maxAgeDays"       = 90,
  "maxFailedAttempts" = 5
WHERE id = 'global'
  AND "minLength" < 12;  -- seulement si la politique n'a pas encore été durcie
