// Risques PROPOSÉS à partir du registre TIC et de la résilience (lot L4) : déclencheurs, clés stables, déduplication
// (écartées / déjà validées), libellés i18n ×5 et cotation suggérée. Rien n'est créé automatiquement.
import { describe, expect, it } from 'vitest'
import type { FonctionDep, UsageDep } from '@/lib/dependances-critiques'
import { fr, en, de, es, it as itT } from '@/lib/i18n'
import {
  calculerPropositionsRisquesTic, propositionsOuvertes, libellerProposition, estClePropositionTic, cleProposition,
  SOURCE_PROPOSITION_TIC, type ContratTicSource,
} from '@/lib/propositions-risques-tic'

const MAINTENANT = new Date('2026-11-03T12:00:00Z')
const usage = (o: Partial<UsageDep> = {}): UsageDep => ({
  id: 'u1', useCase: 'Paiement', tiersId: 't1', tiersNom: 'PSP', offre: 'Passerelle', criticite: 'CRITIQUE', couvert: true, evalue: true,
  exposeInternet: false, perimetrePci: true, avecSi: true, interconnexion: 'LIGNE_SPECIALISEE', hotes: [], contratSansSortie: false,
  evaluation: { statut: 'VALIDEE', valideLe: '2026-06-01' }, ...o,
})
const fonction = (o: Partial<FonctionDep> = {}): FonctionDep => ({
  id: 'p1', nom: 'Paiements', criticiteDora: 'CRITIQUE', proprietaire: 'DP', rtoMinutes: 120, rpoMinutes: 15, toleranceImpactMinutes: 240,
  nbControles: 1, nbRisques: 0, nbIncidents12m: 0, usages: [usage()], dernierTest: { dureeRepriseMinutes: 90, date: '2026-09-01' }, scenarios: [], ...o,
})
const contrat = (o: Partial<ContratTicSource> = {}): ContratTicSource => ({ id: 'a1', reference: 'CT-01', prestataireNom: 'PSP', criticite: 'CRITIQUE', strategieSortie: 'Réversibilité', ...o })
const calc = (fonctions: FonctionDep[], contrats: ContratTicSource[] = []) => calculerPropositionsRisquesTic({ fonctions, contrats, maintenant: MAINTENANT })

describe('calculerPropositionsRisquesTic', () => {
  it('situation saine : aucune proposition', () => {
    expect(calc([fonction()], [contrat()])).toEqual([])
  })
  it('contrat critique ou important sans stratégie de sortie → TIERS_TIC, rattaché au contrat ; non critique ignoré', () => {
    const r = calc([], [contrat({ strategieSortie: '  ' }), contrat({ id: 'a2', criticite: 'NON_CRITIQUE', strategieSortie: null }), contrat({ id: 'a3', criticite: 'IMPORTANTE', strategieSortie: null })])
    expect(r.map(p => p.cle)).toEqual(['CONTRAT_SANS_SORTIE:a1', 'CONTRAT_SANS_SORTIE:a3'])
    expect(r[0]).toMatchObject({ type: 'CONTRAT_SANS_SORTIE', famille: 'TIERS_TIC', origine: { type: 'CONTRAT_TIC', id: 'a1', libelle: 'CT-01 — PSP', lien: '/registre-tic' }, gravite: 4, vraisemblance: 2, processusId: null })
    expect(r[1].gravite).toBe(3)
  })
  it('concentration : même prestataire derrière plusieurs fonctions critiques (calcul de la cartographie réutilisé)', () => {
    const r = calc([fonction(), fonction({ id: 'p2', nom: 'Virements', criticiteDora: 'IMPORTANTE', usages: [usage({ id: 'u2' })] })])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ cle: 'CONCENTRATION_PRESTATAIRE:t1', famille: 'TIERS_TIC', origine: { type: 'TIERS', id: 't1', libelle: 'PSP', lien: '/tiers' }, params: { tiers: 'PSP', fonctions: 'Paiements, Virements' }, gravite: 4, vraisemblance: 3 })
  })
  it('prestataire sans évaluation validée, ou réévaluation échue (12 mois) → une proposition par prestataire', () => {
    const sansEval = calc([fonction({ usages: [usage({ evaluation: null, evalue: false })] })])
    expect(sansEval.map(p => p.cle)).toEqual(['PRESTATAIRE_NON_EVALUE:t1'])
    expect(sansEval[0]).toMatchObject({ famille: 'TIERS_TIC', origine: { type: 'TIERS', id: 't1' }, params: { tiers: 'PSP', fonctions: 'Paiements' }, gravite: 4, vraisemblance: 3 })
    expect(calc([fonction({ usages: [usage({ evaluation: { statut: 'BROUILLON', valideLe: null } })] })]).map(p => p.cle)).toEqual(['PRESTATAIRE_NON_EVALUE:t1'])
    expect(calc([fonction({ usages: [usage({ evaluation: { statut: 'VALIDEE', valideLe: '2025-06-01' } })] })]).map(p => p.cle)).toEqual(['PRESTATAIRE_NON_EVALUE:t1'])
    // Sans détail d'évaluation, repli sur l'indicateur `evalue`.
    expect(calc([fonction({ usages: [usage({ evaluation: undefined, evalue: true })] })])).toEqual([])
  })
  it('RTO au-delà de la tolérance d’impact → CONTINUITE_METIER_TIC rattaché au processus', () => {
    const r = calc([fonction({ rtoMinutes: 480, dernierTest: null })])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ cle: 'RTO_AU_DELA_TOLERANCE:p1', famille: 'CONTINUITE_METIER_TIC', processusId: 'p1', origine: { type: 'PROCESSUS', id: 'p1', libelle: 'Paiements', lien: '/reglementaire' }, params: { fonction: 'Paiements' }, durees: { rto: 480, tolerance: 240 }, gravite: 4, vraisemblance: 3 })
  })
  it('dernier test de reprise au-delà du RTO → CONTINUITE_METIER_TIC ; au-delà de la tolérance : vraisemblance relevée', () => {
    const r = calc([fonction({ criticiteDora: 'IMPORTANTE', dernierTest: { dureeRepriseMinutes: 180, date: '2026-09-01' } })])
    expect(r).toEqual([expect.objectContaining({ cle: 'REPRISE_AU_DELA_RTO:p1', famille: 'CONTINUITE_METIER_TIC', params: { fonction: 'Paiements', date: '2026-09-01' }, durees: { duree: 180, rto: 120 }, gravite: 3, vraisemblance: 3 })])
    expect(calc([fonction({ dernierTest: { dureeRepriseMinutes: 300, date: '2026-09-01' } })])[0].vraisemblance).toBe(4)
    expect(calc([fonction({ dernierTest: { dureeRepriseMinutes: null, date: '2026-09-01' } })])).toEqual([])
  })
})

describe('propositionsOuvertes', () => {
  it('retire les propositions écartées et celles déjà validées (risque existant de même clé)', () => {
    const toutes = calc([fonction({ rtoMinutes: 480, dernierTest: null })], [contrat({ strategieSortie: null }), contrat({ id: 'a2', strategieSortie: null })])
    expect(toutes).toHaveLength(3)
    const r = propositionsOuvertes(toutes, { ecartees: ['CONTRAT_SANS_SORTIE:a1'], validees: ['RTO_AU_DELA_TOLERANCE:p1'] })
    expect(r.map(p => p.cle)).toEqual(['CONTRAT_SANS_SORTIE:a2'])
  })
})

describe('source', () => {
  it('sourceType des risques validés aligné sur la casse existante (analyse, incident)', () => {
    expect(SOURCE_PROPOSITION_TIC).toBe('proposition-tic')
  })
})

describe('clés', () => {
  it('clé stable type + id ; validation du format', () => {
    expect(cleProposition('CONCENTRATION_PRESTATAIRE', 't1')).toBe('CONCENTRATION_PRESTATAIRE:t1')
    expect(estClePropositionTic('CONTRAT_SANS_SORTIE:ckx123')).toBe(true)
    expect(estClePropositionTic('INCONNU:x')).toBe(false)
    expect(estClePropositionTic('CONTRAT_SANS_SORTIE:')).toBe(false)
    expect(estClePropositionTic(42)).toBe(false)
    expect(estClePropositionTic(`CONTRAT_SANS_SORTIE:${'x'.repeat(300)}`)).toBe(false)
  })
})

describe('libellerProposition', () => {
  it('durées formatées selon la langue de t (décimale locale), minutes brutes dans la proposition', () => {
    const [p] = calc([fonction({ rtoMinutes: 90, toleranceImpactMinutes: 45, dernierTest: null })])
    expect(p.durees).toEqual({ rto: 90, tolerance: 45 })
    expect(libellerProposition(p, fr).description).toContain('(1,5 h)')
    expect(libellerProposition(p, fr).description).toContain('(45 min)')
    expect(libellerProposition(p, en).description).toContain('(1.5 h)')
    expect(libellerProposition(p, de).description).toContain('(1,5 h)')
  })
  it('intitulé et description interpolés, dans les 5 langues', () => {
    const [p] = calc([fonction({ rtoMinutes: 480, dernierTest: null })])
    const l = libellerProposition(p, fr)
    expect(l.intitule).toBe('Reprise prévue au-delà de la tolérance d’impact — Paiements')
    expect(l.description).toContain('8 h')
    expect(l.description).toContain('4 h')
    for (const t of [en, de, es, itT]) {
      const x = libellerProposition(p, t)
      expect(x.intitule).toContain('Paiements')
      expect(x.intitule).not.toContain('{')
      expect(x.description).not.toContain('{')
    }
  })
})
