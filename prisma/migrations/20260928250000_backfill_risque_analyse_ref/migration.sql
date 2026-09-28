-- Rattrapage : liens RISQUE_ANALYSE créés par l'import historique sans `ref`.
-- Le contrat exige ref = analyseId (compteurs du registre, liens profonds).
UPDATE "PlanActionLien" AS l
SET "ref" = r."analyseId"
FROM "Risque" AS r
WHERE l."type" = 'RISQUE_ANALYSE' AND l."ref" IS NULL AND l."targetId" = r."id";
