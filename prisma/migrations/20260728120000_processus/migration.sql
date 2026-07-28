-- Socle GRC : référentiel de processus (hiérarchique, par organisation)
CREATE TABLE IF NOT EXISTS "Processus" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "parentId"       TEXT,
  "nom"            TEXT NOT NULL,
  "description"    TEXT,
  "proprietaire"   TEXT,
  "criticite"      INTEGER,
  "ordre"          INTEGER NOT NULL DEFAULT 0,
  "actif"          BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Processus_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Processus_organizationId_idx" ON "Processus"("organizationId");
CREATE INDEX IF NOT EXISTS "Processus_parentId_idx" ON "Processus"("parentId");
DO $$ BEGIN
  ALTER TABLE "Processus" ADD CONSTRAINT "Processus_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Processus" ADD CONSTRAINT "Processus_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Processus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
