-- Absorption de RiskAction par PlanAction (store unifié à liens polymorphes).
-- Une action de traitement d'un risque devient un PlanAction porteur d'un lien
-- RISQUE (targetId = riskItemId). On reprend d'abord les lignes existantes, puis
-- on supprime l'ancienne table.

-- 1) Reprise des actions dans PlanAction (id conservé → liens profonds stables).
INSERT INTO "PlanAction" ("id", "organizationId", "titre", "description", "porteur", "echeance", "priorite", "statut", "createdById", "createdAt", "updatedAt")
SELECT "id", "organizationId", "intitule", "description", "responsable", "echeance", "priorite", "statut", NULL, "createdAt", "updatedAt"
FROM "RiskAction";

-- 2) Lien RISQUE pour chaque action reprise (une action → un risque).
INSERT INTO "PlanActionLien" ("id", "planActionId", "type", "targetId", "ref", "label", "createdAt")
SELECT gen_random_uuid()::text, "id", 'RISQUE', "riskItemId", NULL, NULL, "createdAt"
FROM "RiskAction";

-- 3) Suppression de l'ancienne table (FK CASCADE déjà repris via le lien).
DROP TABLE "RiskAction";
