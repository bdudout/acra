/**
 * dora-reporting.test.ts — workflow de DÉCLARATION d'incident TIC majeur (DORA art. 19).
 *
 * Moteur PUR de délais : à partir des dates de détection et de classification d'un
 * incident MAJEUR, calcule les échéances des 3 phases réglementaires (initiale,
 * intermédiaire, finale) et leur statut (à faire / en retard / soumise), et ne
 * s'applique qu'aux incidents MAJEURS.
 */
import { describe, it, expect } from 'vitest'
import {
  planifierDeclarationDora,
  synthetiserDeclarationDora,
  type DoraEcheance,
} from '@/lib/dora-reporting'

const at = (iso: string) => new Date(iso)
const phase = (r: DoraEcheance[], p: string) => r.find(e => e.phase === p)!

describe('planifierDeclarationDora — applicabilité', () => {
  it('un incident NON majeur → toutes les phases INAPPLICABLE, sans échéance', () => {
    for (const classe of ['SIGNIFICATIF', 'MINEUR', null] as const) {
      const r = planifierDeclarationDora({ classe, dateDetection: '2026-03-01T08:00:00Z', dateClassification: '2026-03-01T08:00:00Z' })
      expect(r.map(e => e.statut)).toEqual(['INAPPLICABLE', 'INAPPLICABLE', 'INAPPLICABLE'])
      expect(r.every(e => e.echeance === null)).toBe(true)
    }
  })
})

describe('planifierDeclarationDora — échéance de la notification initiale', () => {
  it('classification immédiate → 4 h après classification (règle des 4 h prime)', () => {
    const r = planifierDeclarationDora({
      classe: 'MAJEUR', dateDetection: '2026-03-01T08:00:00Z', dateClassification: '2026-03-01T08:00:00Z',
    }, at('2026-03-01T09:00:00Z'))
    expect(phase(r, 'INITIALE').echeance).toEqual(at('2026-03-01T12:00:00Z')) // 08:00 + 4 h
    expect(phase(r, 'INITIALE').statut).toBe('A_FAIRE') // 09:00 < 12:00
  })

  it('classification tardive → plafond des 24 h après détection', () => {
    const r = planifierDeclarationDora({
      classe: 'MAJEUR', dateDetection: '2026-03-01T08:00:00Z', dateClassification: '2026-03-02T07:00:00Z', // +23 h
    }, at('2026-03-01T09:00:00Z'))
    // min(classif+4h = 03-02 11:00, détection+24h = 03-02 08:00) → 03-02 08:00
    expect(phase(r, 'INITIALE').echeance).toEqual(at('2026-03-02T08:00:00Z'))
  })

  it('EN_RETARD quand l’échéance initiale est dépassée et rien de soumis', () => {
    const r = planifierDeclarationDora({
      classe: 'MAJEUR', dateDetection: '2026-03-01T08:00:00Z', dateClassification: '2026-03-01T08:00:00Z',
    }, at('2026-03-01T13:00:00Z')) // après 12:00
    expect(phase(r, 'INITIALE').statut).toBe('EN_RETARD')
  })
})

describe('planifierDeclarationDora — phases intermédiaire & finale', () => {
  it('les échéances suivantes se comptent depuis la soumission initiale si elle existe', () => {
    const r = planifierDeclarationDora({
      classe: 'MAJEUR',
      dateDetection: '2026-03-01T08:00:00Z', dateClassification: '2026-03-01T08:00:00Z',
      initialeSoumiseLe: '2026-03-01T10:00:00Z',
    }, at('2026-03-01T11:00:00Z'))
    expect(phase(r, 'INITIALE').statut).toBe('SOUMIS')
    expect(phase(r, 'INTERMEDIAIRE').echeance).toEqual(at('2026-03-04T10:00:00Z')) // +72 h
    expect(phase(r, 'FINALE').echeance).toEqual(at('2026-03-31T10:00:00Z'))        // +30 j
  })

  it('sans soumission initiale, elles se projettent depuis l’échéance initiale', () => {
    const r = planifierDeclarationDora({
      classe: 'MAJEUR', dateDetection: '2026-03-01T08:00:00Z', dateClassification: '2026-03-01T08:00:00Z',
    }, at('2026-03-01T09:00:00Z'))
    // base = échéance initiale = 12:00
    expect(phase(r, 'INTERMEDIAIRE').echeance).toEqual(at('2026-03-04T12:00:00Z'))
    expect(phase(r, 'FINALE').echeance).toEqual(at('2026-03-31T12:00:00Z'))
  })

  it('une phase soumise est SOUMIS quelle que soit l’heure', () => {
    const r = planifierDeclarationDora({
      classe: 'MAJEUR', dateDetection: '2026-03-01T08:00:00Z', dateClassification: '2026-03-01T08:00:00Z',
      initialeSoumiseLe: '2026-03-01T10:00:00Z', intermediaireSoumiseLe: '2026-03-03T10:00:00Z', finaleSoumiseLe: '2026-03-20T10:00:00Z',
    }, at('2026-04-15T00:00:00Z'))
    expect(r.map(e => e.statut)).toEqual(['SOUMIS', 'SOUMIS', 'SOUMIS'])
  })
})

describe('synthetiserDeclarationDora', () => {
  it('agrège applicabilité, prochaine échéance, retards et soumissions', () => {
    const r = planifierDeclarationDora({
      classe: 'MAJEUR', dateDetection: '2026-03-01T08:00:00Z', dateClassification: '2026-03-01T08:00:00Z',
    }, at('2026-03-01T13:00:00Z')) // initiale en retard, intermédiaire/finale à venir
    const s = synthetiserDeclarationDora(r, at('2026-03-01T13:00:00Z'))
    expect(s.applicable).toBe(true)
    expect(s.enRetard).toBe(1)
    expect(s.soumises).toBe(0)
    expect(s.prochaineEcheance).toEqual(at('2026-03-04T12:00:00Z')) // prochaine NON soumise à venir
  })

  it('un incident non majeur n’est pas applicable', () => {
    const r = planifierDeclarationDora({ classe: 'MINEUR' })
    expect(synthetiserDeclarationDora(r).applicable).toBe(false)
  })
})
