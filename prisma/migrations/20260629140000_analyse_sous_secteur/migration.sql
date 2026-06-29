-- Sous-secteur d'activité (taxonomie sectorielle) — issue #25.
-- Identifiant stable (ex. 'sante-hopital') ; NULL = non précisé. Optionnel.
ALTER TABLE "Analyse" ADD COLUMN "sousSecteur" TEXT;
