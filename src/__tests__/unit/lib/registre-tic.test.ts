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
  cleanArrangementInput,
  validateArrangementInput,
  arrangementToCsvRow,
  REGISTRE_CSV_HEADER,
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

describe('cleanArrangementInput / validateArrangementInput', () => {
  it('normalise : type/criticité inconnus → défauts, trims, sous-traitance', () => {
    const a = cleanArrangementInput({
      reference: '  CT-9 ', prestataireNom: ' Acme ', typeService: 'BOGUS', criticite: 'BOGUS',
      identifiant: '  ', sousTraitance: 'true', dateFin: '2027-01-01',
    })
    expect(a.reference).toBe('CT-9')
    expect(a.prestataireNom).toBe('Acme')
    expect(a.typeService).toBe('AUTRE')       // inconnu → défaut
    expect(a.criticite).toBe('NON_CRITIQUE')  // inconnu → défaut
    expect(a.identifiant).toBe(null)          // vide → null
    expect(a.sousTraitance).toBe(true)
    expect(a.dateFin).toEqual(new Date('2027-01-01'))
  })

  it('exige référence et prestataire', () => {
    expect(validateArrangementInput({ prestataireNom: 'Acme' })).toBe('reference_requise')
    expect(validateArrangementInput({ reference: 'CT-1' })).toBe('prestataire_requis')
  })

  it('rejette une date de fin antérieure au début', () => {
    expect(validateArrangementInput({ reference: 'CT-1', prestataireNom: 'Acme', dateDebut: '2026-06-01', dateFin: '2026-01-01' })).toBe('dates_incoherentes')
  })

  it('une entrée valide → null', () => {
    expect(validateArrangementInput({ reference: 'CT-1', prestataireNom: 'Acme', typeService: 'CLOUD', criticite: 'NON_CRITIQUE' })).toBe(null)
  })
})

describe('arrangementToCsvRow — export registre', () => {
  it('produit une ligne alignée sur l’en-tête, avec dates ISO et indicateur de complétude', () => {
    const a: ArrangementTic = {
      reference: 'CT-1', prestataireNom: 'Acme', identifiant: 'LEI123', pays: 'FR',
      typeService: 'CLOUD', fonctionSupportee: 'Paiements', criticite: 'CRITIQUE',
      dateDebut: '2025-01-01', dateFin: '2027-01-01', paysDonnees: 'FR', sousTraitance: true,
    }
    const row = arrangementToCsvRow(a)
    expect(row.length).toBe(REGISTRE_CSV_HEADER.length)
    expect(row[0]).toBe('CT-1')
    expect(row).toContain('2025-01-01')     // date de début en ISO court
    expect(row[REGISTRE_CSV_HEADER.length - 2]).toBe('oui') // sous-traitance
    expect(row[REGISTRE_CSV_HEADER.length - 1]).toBe('oui') // complet (CRITIQUE renseignée)
  })

  it('marque « non » un arrangement incomplet', () => {
    const a = cleanArrangementInput({ reference: 'CT-2', prestataireNom: 'X', criticite: 'CRITIQUE' })
    expect(arrangementToCsvRow(a)[REGISTRE_CSV_HEADER.length - 1]).toBe('non')
  })
})
