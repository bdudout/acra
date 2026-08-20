-- Socle référentiels & exigences (référentiels custom / PSSI / politiques)
CREATE TABLE "Referentiel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CUSTOM',
    "version" TEXT,
    "description" TEXT,
    "exigences" JSONB NOT NULL DEFAULT '[]',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Referentiel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Referentiel_organizationId_code_key" ON "Referentiel"("organizationId", "code");
CREATE INDEX "Referentiel_organizationId_idx" ON "Referentiel"("organizationId");
ALTER TABLE "Referentiel" ADD CONSTRAINT "Referentiel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
