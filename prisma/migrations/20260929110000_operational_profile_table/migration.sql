-- Profils opérationnels US/UK : table dédiée (auparavant stockés dans
-- "Conformite" sous le préfixe de référentiel 'OP_PROFILE:'). Les évaluations
-- existantes sont reprises telles quelles puis retirées de la conformité.
CREATE TABLE "OperationalProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "cible" TEXT,
    "entries" JSONB NOT NULL DEFAULT '[]',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationalProfile_organizationId_framework_key" ON "OperationalProfile"("organizationId", "framework");
CREATE INDEX "OperationalProfile_organizationId_idx" ON "OperationalProfile"("organizationId");

ALTER TABLE "OperationalProfile" ADD CONSTRAINT "OperationalProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise : l'identifiant est conservé pour que les liens de plan d'action
-- (type OPERATIONAL_PROFILE, targetId = id) restent valides.
INSERT INTO "OperationalProfile" ("id", "organizationId", "framework", "entries", "createdAt", "updatedAt")
SELECT "id", "organizationId", substring("referentiel" from 12), "entries", "createdAt", "updatedAt"
FROM "Conformite"
WHERE "referentiel" LIKE 'OP\_PROFILE:%' AND "entite" = ''
  AND substring("referentiel" from 12) IN ('NIST_CSF_2_0', 'NCSC_CAF_V4')
ON CONFLICT ("organizationId", "framework") DO NOTHING;

DELETE FROM "Conformite" WHERE "referentiel" LIKE 'OP\_PROFILE:%';
