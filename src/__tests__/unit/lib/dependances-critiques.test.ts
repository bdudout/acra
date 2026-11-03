// Cartographie des dépendances des fonctions critiques ou importantes (DORA) : écarts par fonction, concentration
// (un même prestataire ou un même hôte derrière plusieurs fonctions), synthèse.
import { describe, expect, it } from 'vitest'
import { analyserDependances, type FonctionDep, type UsageDep } from '@/lib/dependances-critiques'

const usage = (o: Partial<UsageDep> = {}): UsageDep => ({
  id: 'u1', useCase: 'Paiement', tiersId: 't1', tiersNom: 'PSP', offre: 'Passerelle', criticite: 'CRITIQUE', couvert: true, evalue: true,
  exposeInternet: false, perimetrePci: true, avecSi: true, interconnexion: 'LIGNE_SPECIALISEE', hotes: ['api.psp.example'], ...o,
})
const fonction = (o: Partial<FonctionDep> = {}): FonctionDep => ({
  id: 'p1', nom: 'Paiements', criticiteDora: 'CRITIQUE', proprietaire: 'Direction des paiements', rtoMinutes: 120, rpoMinutes: 15, toleranceImpactMinutes: 240,
  nbControles: 2, nbRisques: 3, nbIncidents12m: 1, usages: [usage()], ...o,
})

describe('analyserDependances', () => {
  it('fonction complète : aucun écart', () => {
    const r = analyserDependances([fonction()])
    expect(r.fonctions[0].ecarts).toEqual([])
    expect(r.synthese).toMatchObject({ fonctions: 1, avecEcarts: 0 })
  })
  it('délais : tolérance absente, RTO absent ou au-delà de la tolérance', () => {
    expect(analyserDependances([fonction({ toleranceImpactMinutes: null })]).fonctions[0].ecarts.map(e => e.code)).toEqual(['TOLERANCE_NON_DEFINIE'])
    expect(analyserDependances([fonction({ rtoMinutes: null })]).fonctions[0].ecarts.map(e => e.code)).toEqual(['RTO_NON_DEFINI'])
    expect(analyserDependances([fonction({ rtoMinutes: 480 })]).fonctions[0].ecarts).toEqual([{ code: 'RTO_AU_DELA_TOLERANCE', gravite: 'ELEVEE' }])
  })
  it('dépendances TIC : hors contrat, sous-qualifiée, non évaluée, exposée et reliée par Internet', () => {
    const f = fonction({ usages: [usage({ couvert: false, criticite: 'NON_CRITIQUE', evalue: false, exposeInternet: true, interconnexion: 'INTERNET' })] })
    expect(analyserDependances([f]).fonctions[0].ecarts).toEqual([
      { code: 'USAGE_SANS_CONTRAT', gravite: 'ELEVEE', usageId: 'u1' },
      { code: 'USAGE_SOUS_QUALIFIE', gravite: 'MOYENNE', usageId: 'u1' },
      { code: 'USAGE_NON_EVALUE', gravite: 'MOYENNE', usageId: 'u1' },
      { code: 'USAGE_EXPOSE_VIA_INTERNET', gravite: 'MOYENNE', usageId: 'u1' },
    ])
  })
  it('aucune dépendance TIC déclarée, aucun contrôle, pas de propriétaire', () => {
    expect(analyserDependances([fonction({ usages: [], nbControles: 0, proprietaire: ' ' })]).fonctions[0].ecarts.map(e => e.code))
      .toEqual(['SANS_PROPRIETAIRE', 'AUCUNE_DEPENDANCE_TIC', 'AUCUN_CONTROLE'])
  })
  it('concentration : un prestataire ou un hôte derrière plusieurs fonctions', () => {
    const r = analyserDependances([
      fonction({ id: 'p1', nom: 'Paiements', usages: [usage({ id: 'u1' })] }),
      fonction({ id: 'p2', nom: 'Virements', usages: [usage({ id: 'u2' })] }),
      fonction({ id: 'p3', nom: 'Crédit', usages: [usage({ id: 'u3', tiersId: 't2', tiersNom: 'Cloud', hotes: ['crm.example'] })] }),
    ])
    expect(r.concentration.tiers).toEqual([{ tiersId: 't1', tiersNom: 'PSP', fonctions: ['Paiements', 'Virements'] }])
    expect(r.concentration.hotes).toEqual([{ hote: 'api.psp.example', fonctions: ['Paiements', 'Virements'] }])
  })
  it('synthèse : nombre de fonctions avec écarts et écarts par code', () => {
    const r = analyserDependances([fonction(), fonction({ id: 'p2', toleranceImpactMinutes: null, nbControles: 0 })])
    expect(r.synthese).toEqual({ fonctions: 2, avecEcarts: 1, ecartsEleves: 0, parCode: { TOLERANCE_NON_DEFINIE: 1, AUCUN_CONTROLE: 1 } })
  })
})
