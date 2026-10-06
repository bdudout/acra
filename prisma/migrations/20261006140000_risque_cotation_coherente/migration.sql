-- Reprise des cotations incohérentes saisies avant le contrôle « actuel ≤ brut, résiduel ≤ actuel » (2026-10-05) :
-- l'actuel est ramené au brut, le résiduel à l'actuel effectif (actuel, sinon brut), puis les niveaux (G × V) des
-- seules lignes corrigées sont recalculés. Idempotent ; ne touche pas les lignes déjà cohérentes.
CREATE TEMP TABLE "_risque_incoherent" AS
SELECT "id" FROM "Risque"
WHERE "graviteActuelle" > "gravite"
   OR "vraisemblanceActuelle" > "vraisemblance"
   OR "graviteResiduelle" > LEAST(COALESCE("graviteActuelle", "gravite"), "gravite")
   OR "vraisemblanceResiduelle" > LEAST(COALESCE("vraisemblanceActuelle", "vraisemblance"), "vraisemblance");

UPDATE "Risque" SET "graviteActuelle" = "gravite"
WHERE "id" IN (SELECT "id" FROM "_risque_incoherent") AND "graviteActuelle" > "gravite";
UPDATE "Risque" SET "vraisemblanceActuelle" = "vraisemblance"
WHERE "id" IN (SELECT "id" FROM "_risque_incoherent") AND "vraisemblanceActuelle" > "vraisemblance";
UPDATE "Risque" SET "graviteResiduelle" = COALESCE("graviteActuelle", "gravite")
WHERE "id" IN (SELECT "id" FROM "_risque_incoherent") AND "graviteResiduelle" > COALESCE("graviteActuelle", "gravite");
UPDATE "Risque" SET "vraisemblanceResiduelle" = COALESCE("vraisemblanceActuelle", "vraisemblance")
WHERE "id" IN (SELECT "id" FROM "_risque_incoherent") AND "vraisemblanceResiduelle" > COALESCE("vraisemblanceActuelle", "vraisemblance");

UPDATE "Risque" SET
  "niveauActuel" = CASE WHEN "niveauActuel" IS NULL THEN NULL ELSE COALESCE("graviteActuelle", "gravite") * COALESCE("vraisemblanceActuelle", "vraisemblance") END,
  "niveauResiduel" = CASE WHEN "niveauResiduel" IS NULL THEN NULL ELSE COALESCE("graviteResiduelle", "graviteActuelle", "gravite") * COALESCE("vraisemblanceResiduelle", "vraisemblanceActuelle", "vraisemblance") END
WHERE "id" IN (SELECT "id" FROM "_risque_incoherent");

DROP TABLE "_risque_incoherent";
