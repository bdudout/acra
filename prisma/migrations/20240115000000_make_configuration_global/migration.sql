-- Configuration : passage d'une config par utilisateur à un singleton global
-- (échelle/seuils communs de l'organisation, définis par l'ADMIN).
--
-- En développement, les configurations par utilisateur existantes (souvent des
-- valeurs par défaut) sont supprimées ; le singleton "global" est recréé à la
-- demande par l'application.

DELETE FROM "Configuration";

ALTER TABLE "Configuration" DROP CONSTRAINT IF EXISTS "Configuration_userId_fkey";
DROP INDEX IF EXISTS "Configuration_userId_key";
ALTER TABLE "Configuration" DROP COLUMN IF EXISTS "userId";
ALTER TABLE "Configuration" ALTER COLUMN "id" SET DEFAULT 'global';
