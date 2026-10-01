-- Audit 2026-10-01 (T11) : une analyse appartient TOUJOURS à une organisation.
-- Avant : `organizationId` nullable + ON DELETE SET NULL ; l'import JSON/CSV
-- (/api/import) créait des analyses sans organisation, hors du périmètre de l'org
-- (invisibles de l'admin et du RSSI). Les analyses orphelines sont rattachées à
-- l'organisation racine « global » (créée si absente, comme le fait l'inscription).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Analyse" WHERE "organizationId" IS NULL) THEN
    INSERT INTO "Organization" ("id", "nom", "slug", "path", "updatedAt")
    VALUES ('global', 'Organisation principale', 'principale', '/global/', NOW())
    ON CONFLICT DO NOTHING;
    UPDATE "Analyse" SET "organizationId" = 'global' WHERE "organizationId" IS NULL;
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "Analyse" DROP CONSTRAINT "Analyse_organizationId_fkey";

-- AlterTable
ALTER TABLE "Analyse" ALTER COLUMN "organizationId" SET NOT NULL;

-- AddForeignKey (RESTRICT : supprimer une organisation impose de supprimer ses analyses explicitement)
ALTER TABLE "Analyse" ADD CONSTRAINT "Analyse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
