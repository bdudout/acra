// Lot H1.4 (docs/specs/scalabilite-haute-disponibilite.md) — déploiement sans interruption : pendant le remplacement
// progressif des réplicas, la version N tourne encore sur une base déjà migrée pour N+1. Une migration NOUVELLE ne doit donc
// rien supprimer, renommer ni durcir que N lit ou écrit encore (règle « expand/contract ») ; une phase « contract » assumée
// porte la marque `-- contract: <justification>`. Cliquet : toutes les migrations du dépôt postérieures à la date de référence.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { classifyMigration, EXPAND_CONTRACT_DEPUIS, soumiseExpandContract, validateExpandContract } from '@/lib/migration-policy'
import { evaluateMigrations } from '@/lib/migration-check'

describe('validateExpandContract', () => {
  it('expand (création, colonne nullable ou avec défaut, index, données) : accepté sans marque', () => {
    for (const sql of [
      'CREATE TABLE "A" ("id" TEXT NOT NULL);',
      'ALTER TABLE "A" ADD COLUMN "x" TEXT;',
      'ALTER TABLE "A" ADD COLUMN "n" INTEGER NOT NULL DEFAULT 0;',
      'CREATE INDEX "i" ON "A"("x");',
      'UPDATE "A" SET "x" = \'a\' WHERE "x" IS NULL;',
    ]) expect(validateExpandContract(sql), sql).toMatchObject({ ok: true })
  })
  it.each([
    ['ALTER TABLE "A" DROP COLUMN "x";'],
    ['DROP TABLE "A";'],
    ['ALTER TABLE "A" RENAME COLUMN "x" TO "y";'],
    ['ALTER TABLE "A" RENAME TO "B";'],
    ['ALTER TABLE "A" ALTER COLUMN "x" TYPE INTEGER USING "x"::integer;'],
    ['ALTER TABLE "A" ALTER COLUMN "x" SET DATA TYPE BIGINT;'],
    ['ALTER TABLE "A" ALTER COLUMN "x" SET NOT NULL;'],
    ['ALTER TABLE "A" ADD COLUMN "x" TEXT NOT NULL;'],
    ['ALTER TYPE "E" RENAME VALUE \'A\' TO \'B\';'],
  ])('contract sans marque : refusé — %s', sql => {
    const r = validateExpandContract(sql)
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/-- contract:/)
  })
  it('contract avec marque justifiée : accepté', () => {
    const sql = '-- acra:destructive colonne remplacée par "y" depuis 1.2.0\n-- contract: "x" n\'est plus lu ni écrit depuis la 1.2.0 (remplacée par "y")\nALTER TABLE "A" DROP COLUMN "x";'
    expect(validateExpandContract(sql)).toMatchObject({ ok: true, class: 'destructive' })
  })
  it('marque vide ou trop courte : refusée (la justification est la preuve de la phase « expand » préalable)', () => {
    expect(validateExpandContract('-- contract:\nDROP TABLE "A";').ok).toBe(false)
    expect(validateExpandContract('-- contract: ok\nDROP TABLE "A";').ok).toBe(false)
  })
  it('une marque dans un commentaire de bloc ou une chaîne ne compte pas', () => {
    expect(validateExpandContract('/*\n-- contract: plus lu depuis la 1.2.0 */\nDROP TABLE "A";').ok).toBe(false)
  })
  it('renommer une valeur d’enum est incompatible avec l’ancien code (classé destructif)', () => {
    expect(classifyMigration('ALTER TYPE "E" RENAME VALUE \'A\' TO \'B\';').class).toBe('destructive')
  })
})

describe('soumiseExpandContract', () => {
  it('seules les migrations horodatées à partir de la date de référence sont soumises', () => {
    expect(EXPAND_CONTRACT_DEPUIS).toMatch(/^\d{14}$/)
    expect(soumiseExpandContract('20261016120000_revisions_ateliers')).toBe(true)
    expect(soumiseExpandContract('20300101000000_x')).toBe(true)
    expect(soumiseExpandContract('20261001090000_analyse_organization_required')).toBe(false)
    expect(soumiseExpandContract('002_b')).toBe(false)
  })
})

describe('evaluateMigrations — CI : expand/contract pour les nouvelles migrations', () => {
  it('nouvelle migration récente destructive avec en-tête acra:destructive mais sans marque contract : violation', () => {
    const r = evaluateMigrations({ '20300101000000_x': '-- acra:destructive nettoyage validé\nDROP TABLE "A";' }, {})
    expect(r.violations).toEqual([expect.objectContaining({ migration: '20300101000000_x', code: 'contract_without_justification' })])
  })
  it('avec les deux marques : aucune violation', () => {
    const sql = '-- acra:destructive nettoyage validé\n-- contract: table plus lue depuis la version 1.2.0\nDROP TABLE "A";'
    expect(evaluateMigrations({ '20300101000000_x': sql }, {}).violations).toEqual([])
  })
  it('migration ancienne (avant la référence) : seule la règle historique s’applique', () => {
    expect(evaluateMigrations({ '002_b': '-- acra:destructive nettoyage validé\nDROP TABLE "A";' }, {}).violations).toEqual([])
  })
})

describe('cliquet expand/contract — migrations du dépôt', () => {
  it('toute migration postérieure à la référence est « expand » ou porte une marque contract justifiée', () => {
    const dir = path.join(process.cwd(), 'prisma', 'migrations')
    const violations: string[] = []
    let vues = 0
    for (const name of readdirSync(dir).sort()) {
      const f = path.join(dir, name, 'migration.sql')
      if (!soumiseExpandContract(name) || !existsSync(f)) continue
      vues++
      const r = validateExpandContract(readFileSync(f, 'utf8'))
      if (!r.ok) violations.push(`${name} : ${r.reason}`)
    }
    expect(vues).toBeGreaterThan(0)
    expect(violations).toEqual([])
  })
})
