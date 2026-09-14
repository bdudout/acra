-- Suivis de conformité multiples (par entité / socle) + lien depuis l'analyse.
-- Défaut de portée de conformité basculé vers ORGANISATION (nouveaux orgs).

-- 1) Défaut de la colonne de config (les rows existants gardent leur valeur stockée).
ALTER TABLE "OrganizationConfig" ALTER COLUMN "conformiteNiveau" SET DEFAULT 'ORGANISATION';

-- 2) Entité Conformite : discriminant + portée + libellé → plusieurs suivis / référentiel.
ALTER TABLE "Conformite" ADD COLUMN "portee" TEXT NOT NULL DEFAULT 'ORGANISATION';
ALTER TABLE "Conformite" ADD COLUMN "entite" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Conformite" ADD COLUMN "nom" TEXT;

-- Nouvelle unicité (org, référentiel, entité) : "" = suivi org-wide, sinon entité/socle.
DROP INDEX IF EXISTS "Conformite_organizationId_referentiel_key";
CREATE UNIQUE INDEX "Conformite_organizationId_referentiel_entite_key"
  ON "Conformite"("organizationId", "referentiel", "entite");

-- 3) Lien optionnel analyse → suivi de conformité.
ALTER TABLE "Analyse" ADD COLUMN "suiviConformiteId" TEXT;
