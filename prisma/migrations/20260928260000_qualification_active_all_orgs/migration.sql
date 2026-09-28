-- Décision utilisateur du 2026-09-28 : le questionnaire de qualification est
-- activé pour TOUTES les organisations existantes (la migration précédente
-- n'avait changé que la valeur par défaut des nouvelles lignes). L'ADMIN de
-- chaque organisation peut ensuite le désactiver dans /configuration.
UPDATE "OrganizationConfig" SET "qualificationActive" = true WHERE "qualificationActive" = false;
