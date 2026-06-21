-- Multi-organisation (Lot 1) : arbre d'organisations + appartenances + rattachement
-- des analyses. Migration RÉTROCOMPATIBLE : crée une organisation racine et y rattache
-- l'existant. L'id de la racine réutilise « global » pour que la config singleton
-- existante (OrganizationConfig "global") devienne la config de la racine.

-- CreateEnum
CREATE TYPE "OrgScope" AS ENUM ('NODE', 'SUBTREE');

-- AlterEnum (nouvelle valeur de rôle, non utilisée dans cette migration)
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "Analyse" ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "path" TEXT NOT NULL DEFAULT '/',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ANALYSTE',
    "scope" "OrgScope" NOT NULL DEFAULT 'NODE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX "Organization_parentId_idx" ON "Organization"("parentId");
CREATE INDEX "Organization_path_idx" ON "Organization"("path");
CREATE INDEX "OrgMembership_userId_idx" ON "OrgMembership"("userId");
CREATE INDEX "OrgMembership_organizationId_idx" ON "OrgMembership"("organizationId");
CREATE UNIQUE INDEX "OrgMembership_userId_organizationId_key" ON "OrgMembership"("userId", "organizationId");
CREATE INDEX "Analyse_organizationId_idx" ON "Analyse"("organizationId");

-- ─── Backfill rétrocompatible (AVANT les contraintes de clé étrangère) ──────────

-- Organisation racine « Organisation principale » (id = 'global' pour réutiliser la
-- config singleton existante comme config de la racine).
INSERT INTO "Organization" ("id","nom","slug","parentId","path","actif","createdAt","updatedAt")
VALUES ('global', 'Organisation principale', 'principale', NULL, '/global/', true, now(), now())
ON CONFLICT ("id") DO NOTHING;

-- Rattacher toutes les analyses existantes à la racine.
UPDATE "Analyse" SET "organizationId" = 'global' WHERE "organizationId" IS NULL;

-- Une appartenance par utilisateur (rôle = rôle actuel ; portée SUBTREE pour les ADMIN
-- afin qu'ils conservent une vision sur tout l'arbre, NODE sinon).
INSERT INTO "OrgMembership" ("id","userId","organizationId","role","scope","createdAt")
SELECT 'mb_' || u."id", u."id", 'global', u."role",
       (CASE WHEN u."role" = 'ADMIN' THEN 'SUBTREE' ELSE 'NODE' END)::"OrgScope",
       now()
FROM "User" u
ON CONFLICT ("userId","organizationId") DO NOTHING;

-- S'assurer que la config singleton « global » existe (config de la racine).
INSERT INTO "OrganizationConfig" ("id","updatedAt") VALUES ('global', now())
ON CONFLICT ("id") DO NOTHING;

-- ─── Contraintes de clé étrangère (après cohérence des données) ─────────────────

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Analyse" ADD CONSTRAINT "Analyse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationConfig" ADD CONSTRAINT "OrganizationConfig_id_fkey" FOREIGN KEY ("id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
