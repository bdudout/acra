-- Plusieurs sous-secteurs par analyse (le premier = principal, recopié dans "sousSecteur").
ALTER TABLE "Analyse" ADD COLUMN "sousSecteurs" JSONB NOT NULL DEFAULT '[]';

-- Reprise de l'existant : le sous-secteur unique devient la liste à un élément.
UPDATE "Analyse" SET "sousSecteurs" = jsonb_build_array("sousSecteur") WHERE "sousSecteur" IS NOT NULL;
