-- Fonctions spécifiques activables séparément (3 niveaux, cf. lib/module-policy) : campagnes RCSA, appétence au risque
-- (RAS / RAD), rapports GRC. Désactivées par défaut.
ALTER TABLE "OrganizationConfig" ADD COLUMN "campagnesRcsaActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrganizationConfig" ADD COLUMN "appetenceActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrganizationConfig" ADD COLUMN "rapportsGrcActive" BOOLEAN NOT NULL DEFAULT false;

-- Reprise de l'existant : une organisation qui se servait déjà d'une de ces fonctions la garde active. L'interrupteur est
-- posé sur la ligne de configuration dont elle HÉRITE (la sienne ou celle de l'ancêtre le plus proche qui en a une), pour
-- ne pas figer ses autres réglages ; une ligne n'est créée que si aucune n'existe dans toute la chaîne (valeurs par défaut).

-- Campagnes RCSA : au moins une campagne.
WITH cible AS (
  SELECT u.org, (
    SELECT a.id FROM "Organization" a JOIN "OrganizationConfig" c ON c.id = a.id
    WHERE (SELECT o.path FROM "Organization" o WHERE o.id = u.org) LIKE '%/' || a.id || '/%'
    ORDER BY length(a.path) DESC LIMIT 1
  ) AS cfg
  FROM (SELECT DISTINCT "organizationId" AS org FROM "Campagne") u
)
UPDATE "OrganizationConfig" SET "campagnesRcsaActive" = true WHERE id IN (SELECT cfg FROM cible WHERE cfg IS NOT NULL);
WITH cible AS (
  SELECT u.org, (
    SELECT a.id FROM "Organization" a JOIN "OrganizationConfig" c ON c.id = a.id
    WHERE (SELECT o.path FROM "Organization" o WHERE o.id = u.org) LIKE '%/' || a.id || '/%'
    ORDER BY length(a.path) DESC LIMIT 1
  ) AS cfg
  FROM (SELECT DISTINCT "organizationId" AS org FROM "Campagne") u
)
INSERT INTO "OrganizationConfig" (id, "campagnesRcsaActive", "updatedAt")
SELECT org, true, now() FROM cible WHERE cfg IS NULL
ON CONFLICT (id) DO UPDATE SET "campagnesRcsaActive" = true;

-- Appétence : instantané figé manuellement ou appétit au risque renseigné.
WITH cible AS (
  SELECT u.org, (
    SELECT a.id FROM "Organization" a JOIN "OrganizationConfig" c ON c.id = a.id
    WHERE (SELECT o.path FROM "Organization" o WHERE o.id = u.org) LIKE '%/' || a.id || '/%'
    ORDER BY length(a.path) DESC LIMIT 1
  ) AS cfg
  FROM (SELECT DISTINCT "organizationId" AS org FROM "AppetenceSnapshot" WHERE "createdById" IS NOT NULL UNION SELECT id AS org FROM "OrganizationConfig" WHERE "appetitRisque"::text NOT IN ('{}', 'null')) u
)
UPDATE "OrganizationConfig" SET "appetenceActive" = true WHERE id IN (SELECT cfg FROM cible WHERE cfg IS NOT NULL);
WITH cible AS (
  SELECT u.org, (
    SELECT a.id FROM "Organization" a JOIN "OrganizationConfig" c ON c.id = a.id
    WHERE (SELECT o.path FROM "Organization" o WHERE o.id = u.org) LIKE '%/' || a.id || '/%'
    ORDER BY length(a.path) DESC LIMIT 1
  ) AS cfg
  FROM (SELECT DISTINCT "organizationId" AS org FROM "AppetenceSnapshot" WHERE "createdById" IS NOT NULL UNION SELECT id AS org FROM "OrganizationConfig" WHERE "appetitRisque"::text NOT IN ('{}', 'null')) u
)
INSERT INTO "OrganizationConfig" (id, "appetenceActive", "updatedAt")
SELECT org, true, now() FROM cible WHERE cfg IS NULL
ON CONFLICT (id) DO UPDATE SET "appetenceActive" = true;

-- Rapports GRC : au moins une édition, ou des gabarits personnalisés.
WITH cible AS (
  SELECT u.org, (
    SELECT a.id FROM "Organization" a JOIN "OrganizationConfig" c ON c.id = a.id
    WHERE (SELECT o.path FROM "Organization" o WHERE o.id = u.org) LIKE '%/' || a.id || '/%'
    ORDER BY length(a.path) DESC LIMIT 1
  ) AS cfg
  FROM (SELECT DISTINCT "organizationId" AS org FROM "RapportEdition" UNION SELECT id AS org FROM "OrganizationConfig" WHERE "rapportsConfig"::text NOT IN ('{}', 'null')) u
)
UPDATE "OrganizationConfig" SET "rapportsGrcActive" = true WHERE id IN (SELECT cfg FROM cible WHERE cfg IS NOT NULL);
WITH cible AS (
  SELECT u.org, (
    SELECT a.id FROM "Organization" a JOIN "OrganizationConfig" c ON c.id = a.id
    WHERE (SELECT o.path FROM "Organization" o WHERE o.id = u.org) LIKE '%/' || a.id || '/%'
    ORDER BY length(a.path) DESC LIMIT 1
  ) AS cfg
  FROM (SELECT DISTINCT "organizationId" AS org FROM "RapportEdition" UNION SELECT id AS org FROM "OrganizationConfig" WHERE "rapportsConfig"::text NOT IN ('{}', 'null')) u
)
INSERT INTO "OrganizationConfig" (id, "rapportsGrcActive", "updatedAt")
SELECT org, true, now() FROM cible WHERE cfg IS NULL
ON CONFLICT (id) DO UPDATE SET "rapportsGrcActive" = true;
