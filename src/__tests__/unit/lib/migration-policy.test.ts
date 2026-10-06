// Lot 5 — politique de migrations : additive / destructive / data ; en-tête `-- acra:destructive <raison>`.
import { describe, it, expect } from 'vitest'
import { classifyMigration, validateNewMigration } from '@/lib/migration-policy'

describe('classifyMigration', () => {
  it('additive : création de table, colonne nullable, index, enum', () => {
    const sql = 'CREATE TABLE "A" ("id" TEXT NOT NULL);\nALTER TABLE "B" ADD COLUMN "x" TEXT;\nCREATE INDEX "i" ON "B"("x");\nCREATE TYPE "E" AS ENUM (\'A\');\nALTER TYPE "E" ADD VALUE \'B\';'
    expect(classifyMigration(sql).class).toBe('additive')
  })
  it.each([
    ['DROP TABLE "A";'], ['ALTER TABLE "A" DROP COLUMN "x";'], ['DROP TYPE "E";'], ['TRUNCATE "A";'],
    ['ALTER TABLE "A" ALTER COLUMN "x" TYPE INTEGER USING "x"::integer;'], ['ALTER TABLE "A" RENAME COLUMN "x" TO "y";'], ['ALTER TABLE "A" RENAME TO "B";'],
    ['ALTER TABLE "A" ALTER COLUMN "x" SET NOT NULL;'], ['DROP SCHEMA x CASCADE;'],
  ])('destructive : %s', sql => expect(classifyMigration(sql).class).toBe('destructive'))
  it('ADD COLUMN NOT NULL sans DEFAULT est destructif (échoue sur table non vide) ; avec DEFAULT, additif', () => {
    expect(classifyMigration('ALTER TABLE "A" ADD COLUMN "x" TEXT NOT NULL;').class).toBe('destructive')
    expect(classifyMigration('ALTER TABLE "A" ADD COLUMN "x" TEXT NOT NULL DEFAULT \'a\';').class).toBe('additive')
  })
  it('data : UPDATE / INSERT / DELETE', () => {
    expect(classifyMigration('UPDATE "A" SET "x" = 1;').class).toBe('data')
    expect(classifyMigration('INSERT INTO "A" VALUES (1);').class).toBe('data')
    expect(classifyMigration('CREATE TABLE "A" ("id" TEXT);\nDELETE FROM "B";').class).toBe('data')
  })
  it('destructive l’emporte sur data', () => {
    expect(classifyMigration('UPDATE "A" SET x=1;\nDROP TABLE "B";').class).toBe('destructive')
  })
  it('les commentaires et les chaînes sont ignorés', () => {
    expect(classifyMigration('-- DROP TABLE "A";\n/* ALTER TABLE "A" DROP COLUMN x; */\nCREATE TABLE "B" ("id" TEXT);').class).toBe('additive')
    expect(classifyMigration('ALTER TABLE "A" ADD COLUMN "d" TEXT DEFAULT \'DROP TABLE x; UPDATE y\';').class).toBe('additive')
  })
  it('en-tête reconnu avec sa raison', () => {
    const r = classifyMigration('-- acra:destructive colonne obsolète supprimée après migration des données\nALTER TABLE "A" DROP COLUMN "x";')
    expect(r.class).toBe('destructive'); expect(r.header).toBe('colonne obsolète supprimée après migration des données')
    expect(classifyMigration('-- acra:destructive\nDROP TABLE "A";').header).toBe('')
  })
  it('liste les motifs', () => {
    expect(classifyMigration('DROP TABLE "A"; TRUNCATE "B";').reasons.length).toBeGreaterThanOrEqual(2)
  })
})

describe('validateNewMigration', () => {
  it('une migration nouvelle destructive sans en-tête avec raison est refusée', () => {
    expect(validateNewMigration('DROP TABLE "A";').ok).toBe(false)
    expect(validateNewMigration('-- acra:destructive\nDROP TABLE "A";').ok).toBe(false)
    expect(validateNewMigration('-- acra:destructive nettoyage validé\nDROP TABLE "A";').ok).toBe(true)
  })
  it('additive ou data : acceptée', () => {
    expect(validateNewMigration('CREATE TABLE "A" ("id" TEXT);').ok).toBe(true)
    expect(validateNewMigration('UPDATE "A" SET x = 1;').ok).toBe(true)
  })
})

describe('classifyMigration — table temporaire', () => {
  it('supprimer une table temporaire créée dans la même migration n’est pas destructif', async () => {
    const { classifyMigration } = await import('@/lib/migration-policy')
    const sql = 'CREATE TEMP TABLE "_tmp" AS SELECT "id" FROM "Risque";\nUPDATE "Risque" SET "x" = 1 WHERE "id" IN (SELECT "id" FROM "_tmp");\nDROP TABLE "_tmp";'
    expect(classifyMigration(sql)).toMatchObject({ class: 'data', reasons: ['UPDATE'] })
    expect(classifyMigration('CREATE TEMPORARY TABLE t AS SELECT 1;\nDROP TABLE IF EXISTS t;').class).toBe('additive')
  })
  it('supprimer une vraie table reste destructif, même à côté d’une table temporaire', async () => {
    const { classifyMigration } = await import('@/lib/migration-policy')
    expect(classifyMigration('CREATE TEMP TABLE "_tmp" AS SELECT 1;\nDROP TABLE "_tmp";\nDROP TABLE "Risque";').class).toBe('destructive')
  })
})
