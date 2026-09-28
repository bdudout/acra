-- Module optionnel de profils opérationnels NIST CSF 2.0 / NCSC CAF v4.
-- Le défaut à false préserve strictement le parcours standard EBIOS RM / ISO 27005.
ALTER TABLE "OrganizationConfig"
ADD COLUMN IF NOT EXISTS "profilsOperationnelsActive" BOOLEAN NOT NULL DEFAULT false;
