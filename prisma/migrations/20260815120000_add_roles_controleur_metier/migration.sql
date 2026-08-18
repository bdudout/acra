-- Ajout de deux rôles (issue « rôles manquants ») :
--   CONTROLEUR : 2ᵉ ligne de défense (contrôle permanent), distinct de l'auditeur.
--   METIER     : 1ʳᵉ ligne de défense (opérationnel), distinct de la direction métier.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CONTROLEUR';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'METIER';
