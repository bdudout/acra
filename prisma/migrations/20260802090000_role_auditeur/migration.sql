-- Rôle AUDITEUR (3ᵉ ligne de défense) — lecture globale, écriture sur le module Audit interne
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'AUDITEUR';
