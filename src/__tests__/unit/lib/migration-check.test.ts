// Lot 5 — vérification des migrations d'une branche (CI) et des migrations en attente (PRECHECK de la mise à jour).
import { describe, it, expect } from 'vitest'
import { evaluateMigrations } from '@/lib/migration-check'

const add = 'CREATE TABLE "A" ("id" TEXT);'
describe('evaluateMigrations', () => {
  it('migration nouvelle additive : aucune violation', () => {
    const r = evaluateMigrations({ '001_a': add, '002_b': add }, { '001_a': add })
    expect(r.violations).toEqual([])
  })
  it('migration nouvelle destructive sans en-tête : violation', () => {
    const r = evaluateMigrations({ '001_a': add, '002_b': 'DROP TABLE "A";' }, { '001_a': add })
    expect(r.violations).toEqual([expect.objectContaining({ migration: '002_b', code: 'destructive_without_header' })])
  })
  it('migration nouvelle destructive avec en-tête et raison : acceptée', () => {
    expect(evaluateMigrations({ '002_b': '-- acra:destructive nettoyage validé\nDROP TABLE "A";' }, {}).violations).toEqual([])
  })
  it('migration existante modifiée : violation', () => {
    const r = evaluateMigrations({ '001_a': add + ' -- changé' }, { '001_a': add })
    expect(r.violations).toEqual([expect.objectContaining({ migration: '001_a', code: 'modified' })])
  })
  it('migration existante supprimée : violation', () => {
    expect(evaluateMigrations({}, { '001_a': add }).violations).toEqual([expect.objectContaining({ migration: '001_a', code: 'removed' })])
  })
  it('migrations en attente : cible moins appliquées, avec leur classe', () => {
    const r = evaluateMigrations({ '001_a': add, '002_b': 'UPDATE "A" SET x = 1;', '003_c': 'DROP TABLE "A";' }, { '001_a': add, '002_b': 'UPDATE "A" SET x = 1;', '003_c': 'DROP TABLE "A";' }, ['001_a'])
    expect(r.pending).toEqual([{ migration: '002_b', class: 'data' }, { migration: '003_c', class: 'destructive' }])
    expect(r.destructive).toEqual(['003_c'])
  })
  it('sans liste d’appliquées : pas de pending', () => {
    expect(evaluateMigrations({ '001_a': add }, null).pending).toEqual([])
  })
})
