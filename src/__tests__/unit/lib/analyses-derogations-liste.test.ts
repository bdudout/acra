// Fonctions pures des listes paginées « Analyses » et « Registre des dérogations » (lot V1).
import { describe, expect, it } from 'vitest'
import { comparerParRisque, filtrerAnalyses, statutDepuisParam, trierAnalyses } from '@/lib/analyses-liste'
import { ajusterCompteurs, compterParFiltre, filtrerRegistre, lireFiltreRegistre, trierRegistre, type RegistreRow } from '@/lib/derogations-registre'

const an = (nom: string, o: { statut?: string; tags?: string[]; max?: number; risques?: number; maj?: string; organisation?: string | null } = {}) => ({
  nom, organisation: o.organisation ?? null, statut: o.statut ?? 'EN_COURS', tags: o.tags ?? [], atelierCourant: 1,
  updatedAt: o.maj ?? '2026-10-01', _count: { risques: o.risques ?? 0 }, riskSummary: { maxRisk: o.max ?? 0 },
})

describe('analyses-liste', () => {
  it('paramètre `filter` de l’URL → statut', () => {
    expect(statutDepuisParam('en_cours')).toBe('EN_COURS')
    expect(statutDepuisParam('approuve')).toBe('APPROUVE')
    expect(statutDepuisParam('n_importe')).toBe('ALL')
    expect(statutDepuisParam(null)).toBe('ALL')
  })
  it('tri par défaut : risque max, puis nombre de risques, puis modification récente', () => {
    const l = [an('A', { max: 4, risques: 1 }), an('B', { max: 9 }), an('C', { max: 4, risques: 3 }), an('D', { max: 4, risques: 3, maj: '2026-10-05' })]
    expect([...l].sort(comparerParRisque).map(x => x.nom)).toEqual(['B', 'D', 'C', 'A'])
    expect(trierAnalyses(l, 'defaut', 'desc').map(x => x.nom)).toEqual(['B', 'D', 'C', 'A'])
    expect(trierAnalyses(l, 'nom', 'desc').map(x => x.nom)).toEqual(['D', 'C', 'B', 'A'])
  })
  it('filtres : tag exact sans casse, statut, recherche sur nom et organisation (sans accents)', () => {
    const l = [an('Paie', { tags: ['RH'] }), an('Écoles', { organisation: 'Ville', statut: 'TERMINE' }), an('Portail', { tags: ['rh'], organisation: 'Région' })]
    expect(filtrerAnalyses(l, { tag: 'Rh' }).map(x => x.nom)).toEqual(['Paie', 'Portail'])
    expect(filtrerAnalyses(l, { statut: 'TERMINE' }).map(x => x.nom)).toEqual(['Écoles'])
    expect(filtrerAnalyses(l, { q: 'region' }).map(x => x.nom)).toEqual(['Portail'])
    expect(filtrerAnalyses(l, { q: 'ecol' }).map(x => x.nom)).toEqual(['Écoles'])
  })
})

const jours = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()
const row = (id: string, statut: string, dateFin: string | null = null, o: Partial<RegistreRow> = {}): RegistreRow => ({
  id, analyseId: null, analyseNom: null, portee: 'CONTROLE', referentiel: 'ISO27001', ref: 'A.5', intitule: id, statut, dateFin, ...o,
})

describe('derogations-registre', () => {
  const rows = [row('active', 'ACTIVE', jours(90)), row('bientot', 'ACTIVE', jours(5)), row('expiree', 'ACTIVE', jours(-1)), row('revue', 'DOUBLE_REGARD'), row('retiree', 'RETIREE')]
  it('filtre de l’URL : valeur inconnue → filtre par défaut', () => {
    expect(lireFiltreRegistre('EXPIREES')).toBe('EXPIREES')
    expect(lireFiltreRegistre('X')).toBe('EN_COURS_EXP')
    expect(lireFiltreRegistre(null)).toBe('EN_COURS_EXP')
  })
  it('compteurs de tous les filtres sur l’état effectif', () => {
    expect(compterParFiltre(rows)).toEqual({ EN_COURS_EXP: 3, EN_COURS: 2, EXPIREES: 1, EN_REVUE: 1, CLOTUREES: 1 })
  })
  it('filtre + recherche (intitulé, analyse, référentiel, contrôle)', () => {
    expect(filtrerRegistre(rows, { filtre: 'EN_COURS' }).map(r => r.id)).toEqual(['active', 'bientot'])
    expect(filtrerRegistre([...rows, row('x', 'ACTIVE', null, { analyseNom: 'Paie RH' })], { filtre: 'EN_COURS_EXP', q: 'paie' }).map(r => r.id)).toEqual(['x'])
  })
  it('ajustement en place des compteurs après une action (retrait d’une demande en revue)', () => {
    const c = compterParFiltre(rows)
    expect(ajusterCompteurs(c, { statut: 'DOUBLE_REGARD', dateFin: null }, { statut: 'RETIREE', dateFin: null })).toEqual({ ...c, EN_REVUE: 0, CLOTUREES: 2 })
  })
  it('tri : défaut = ordre de la requête ; échéance ascendante, sans date en fin', () => {
    expect(trierRegistre(rows, 'defaut', 'asc')).toBe(rows)
    expect(trierRegistre(rows, 'echeance', 'asc').map(r => r.id)).toEqual(['expiree', 'bientot', 'active', 'revue', 'retiree'])
  })
})
