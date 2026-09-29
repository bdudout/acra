-- Maturité (profils cibles CMMI) portée par l'objet Conformite : même suivi, même
-- référentiel, mêmes références de points que la conformité (décision 2026-09-29).
ALTER TABLE "Conformite" ADD COLUMN "maturites" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Conformite" ADD COLUMN "maturiteCible" INTEGER;

-- Échelle de maturité CMMI personnalisable par organisation (vide = défaut).
ALTER TABLE "OrganizationConfig" ADD COLUMN "echelleMaturite" JSONB NOT NULL DEFAULT '[]';

-- Dérogations : avis RSSI « favorable avec réserves » et retrait par le demandeur.
ALTER TABLE "Derogation" ADD COLUMN "avisRssiReserves" TEXT;
ALTER TABLE "Derogation" ADD COLUMN "retireeLe" TIMESTAMP(3);
ALTER TABLE "Derogation" ADD COLUMN "retraitMotif" TEXT;

-- Les actions issues de l'ancien module « profils opérationnels » deviennent des
-- actions de conformité ordinaires (lien CONFORMITE : targetId = code du référentiel,
-- ref = point) sur le référentiel livré correspondant.
UPDATE "PlanActionLien" AS l
SET "type" = 'CONFORMITE',
    "targetId" = CASE p."framework" WHEN 'NIST_CSF_2_0' THEN 'NIST_CSF' ELSE 'NCSC_CAF' END
FROM "OperationalProfile" AS p
WHERE l."type" = 'OPERATIONAL_PROFILE' AND l."targetId" = p."id";
DELETE FROM "PlanActionLien" WHERE "type" = 'OPERATIONAL_PROFILE';

-- Les évaluations de l'ancien module (statuts au niveau catégorie, module désactivé
-- par défaut) n'ont pas d'équivalent de maturité : la table est retirée.
DROP TABLE "OperationalProfile";
