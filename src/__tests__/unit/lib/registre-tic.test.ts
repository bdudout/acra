/**
 * registre-tic.test.ts — Registre d'information des prestataires tiers TIC (DORA art. 28).
 *
 * Moteur PUR : validation de complétude d'un arrangement contractuel vis-à-vis des
 * champs attendus par les ITS (plus exigeants pour les fonctions critiques/importantes),
 * et synthèse de pilotage (concentration, criticité, expirations).
 */
import { describe, it, expect } from 'vitest'
import {
  validerArrangement,
  evaluerCompletude,
  synthetiserRegistre,
  type ArrangementTic,
} from '@/lib/registre-tic'

const base = (over: Partial<ArrangementTic> = {}): ArrangementTic => ({
  reference: 'CT-001',
  prestataireNom: 'CloudCorp',
  typeService: 'CLOUD',
  criticite: 'NON_CRITIQUE',
  ...over,
})

describe('validerArrangement — champs requis', () => {
  it('un arrangement non critique minimal est valide', () => {
    expect(validerArrangement(base())).toEqual([])
  })

  it('signale les champs de base manquants', () => {
    const manquants = validerArrangement({ reference: '', prestataireNom: '  ', typeService: 'CLOUD', criticite: 'NON_CRITIQUE' } as ArrangementTic)
    expect(manquants).toContain('reference')
    expect(manquants).toContain('prestataireNom')
  })

  it('une fonction CRITIQUE exige identifiant, pays, fonction et date de début', () => {
    const manquants = validerArrangement(base({ criticite: 'CRITIQUE' }))
    expect(manquants).toEqual(expect.arrayContaining(['identifiant', 'pays', 'fonctionSupportee', 'dateDebut']))
  })

  it('une fonction IMPORTANTE complète est valide', () => {
    const ok = base({
      criticite: 'IMPORTANTE', identifiant: '969500XXXXXXX', pays: 'FR',
      fonctionSupportee: 'Paiements', dateDebut: '2025-01-01',
    })
    expect(validerArrangement(ok)).toEqual([])
  })
})

describe('evaluerCompletude', () => {
  it('compte les arrangements complets vs incomplets', () => {
    const c = evaluerCompletude([
      base(),                                   // complet
      base({ criticite: 'CRITIQUE' }),          // incomplet (manque identifiant…)
    ])
    expect(c.total).toBe(2)
    expect(c.complets).toBe(1)
    expect(c.incomplets).toBe(1)
  })
})

describe('synthetiserRegistre', () => {
  const maintenant = new Date('2026-03-01T00:00:00Z')
  const arrangements: ArrangementTic[] = [
    base({ reference: 'A', prestataireNom: 'CloudCorp', criticite: 'CRITIQUE', dateFin: '2026-03-30' }),
    base({ reference: 'B', prestataireNom: 'CloudCorp', criticite: 'IMPORTANTE', sousTraitance: true }),
    base({ reference: 'C', prestataireNom: 'NetItd',    criticite: 'NON_CRITIQUE', dateFin: '2027-01-01' }),
  ]

  it('agrège arrangements, prestataires distincts, critiques et sous-traitance', () => {
    const s = synthetiserRegistre(arrangements, { maintenant, expirationJours: 90 })
    expect(s.arrangements).toBe(3)
    expect(s.prestataires).toBe(2)        // CloudCorp + NetItd
    expect(s.critiques).toBe(2)           // CRITIQUE + IMPORTANTE
    expect(s.sousTraitance).toBe(1)
  })

  it('calcule la concentration (part du prestataire le plus présent)', () => {
    const s = synthetiserRegistre(arrangements, { maintenant })
    expect(s.concentrationTop?.prestataire).toBe('CloudCorp')
    expect(s.concentrationTop?.part).toBeCloseTo(2 / 3, 5)
  })

  it('compte les contrats expirant dans la fenêtre', () => {
    const s = synthetiserRegistre(arrangements, { maintenant, expirationJours: 90 })
    expect(s.expirentBientot).toBe(1)     // A finit le 30/03 (< 90 j), C en 2027 (hors fenêtre)
  })

  it('registre vide → zéros et concentration nulle', () => {
    const s = synthetiserRegistre([], { maintenant })
    expect(s.arrangements).toBe(0)
    expect(s.prestataires).toBe(0)
    expect(s.concentrationTop).toBe(null)
  })
})
