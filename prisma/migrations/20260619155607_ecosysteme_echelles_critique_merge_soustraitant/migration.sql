-- Reclasse les sous-traitants en prestataires AVANT de retirer la valeur d'enum
-- (le guide EBIOS RM range les sous-traitants parmi les prestataires).
-- Doit s'exécuter tant que la colonne porte encore l'ancien type enum.
UPDATE "PartiePrenante" SET "type" = 'PRESTATAIRE' WHERE "type" = 'SOUS_TRAITANT';

-- AlterEnum : retrait de SOUS_TRAITANT
BEGIN;
CREATE TYPE "TypePartiePrenante_new" AS ENUM ('FOURNISSEUR', 'CLIENT', 'PARTENAIRE', 'PRESTATAIRE', 'ORGANISME_REGULATION', 'AUTRE');
ALTER TABLE "PartiePrenante" ALTER COLUMN "type" TYPE "TypePartiePrenante_new" USING ("type"::text::"TypePartiePrenante_new");
ALTER TYPE "TypePartiePrenante" RENAME TO "TypePartiePrenante_old";
ALTER TYPE "TypePartiePrenante_new" RENAME TO "TypePartiePrenante";
DROP TYPE "TypePartiePrenante_old";
COMMIT;

-- AlterTable : échelles écosystème configurables
ALTER TABLE "OrganizationConfig" ADD COLUMN     "echellesEcosysteme" JSONB NOT NULL DEFAULT '{}';

-- AlterTable : marquage tiers critique
ALTER TABLE "PartiePrenante" ADD COLUMN     "critique" BOOLEAN NOT NULL DEFAULT false;
