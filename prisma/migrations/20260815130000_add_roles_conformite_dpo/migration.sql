-- Deux rôles de 2ᵉ ligne supplémentaires :
--   CONFORMITE : pilote la conformité (ISO 27001, NIS2, DORA…) et la gouvernance.
--   DPO        : délégué à la protection des données (RGPD).
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CONFORMITE';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DPO';
