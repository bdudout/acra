import { describe, it, expect } from 'vitest'
import { incidentSimilarity, findIncidentDuplicates, findDuplicatesForAll, type IncidentDedupItem } from '@/lib/incident-dedup'

const item = (o: Partial<IncidentDedupItem> & { id: string; intitule: string }): IncidentDedupItem => ({
  statut: 'DECLARE', dateSurvenance: null, dateDetection: null, processusId: null, entite: null, taxonomieCode: null, ...o,
})

describe('incidentSimilarity', () => {
  it('titres identiques → score élevé (≥ seuil)', () => {
    const a = item({ id: 'a', intitule: 'Panne du service de paiement en ligne' })
    const b = item({ id: 'b', intitule: 'Panne du service de paiement en ligne' })
    expect(incidentSimilarity(a, b)).toBeGreaterThanOrEqual(0.5)
  })
  it('titres proches + même jour + même processus → très élevé', () => {
    const a = item({ id: 'a', intitule: 'Indisponibilité de la banque en ligne', dateSurvenance: '2026-03-01', processusId: 'p1', entite: 'DSI' })
    const b = item({ id: 'b', intitule: 'Indisponibilité banque en ligne', dateSurvenance: '2026-03-01', processusId: 'p1', entite: 'DSI' })
    expect(incidentSimilarity(a, b)).toBeGreaterThan(0.8)
  })
  it('titres sans rapport → score faible', () => {
    const a = item({ id: 'a', intitule: 'Fuite de données clients' })
    const b = item({ id: 'b', intitule: 'Retard de livraison fournisseur' })
    expect(incidentSimilarity(a, b)).toBeLessThan(0.4)
  })
  it('la proximité de date renforce, l’éloignement neutralise', () => {
    const a = item({ id: 'a', intitule: 'Erreur de virement', dateSurvenance: '2026-03-01' })
    const proche = item({ id: 'b', intitule: 'Erreur de virement', dateSurvenance: '2026-03-02' })
    const loin = item({ id: 'c', intitule: 'Erreur de virement', dateSurvenance: '2026-09-01' })
    expect(incidentSimilarity(a, proche)).toBeGreaterThan(incidentSimilarity(a, loin))
  })
})

describe('findIncidentDuplicates', () => {
  const candidate = item({ id: 'new', intitule: 'Panne du portail client', dateSurvenance: '2026-03-01', processusId: 'p1' })
  const existing: IncidentDedupItem[] = [
    item({ id: 'x1', intitule: 'Panne portail client', dateSurvenance: '2026-03-01', processusId: 'p1' }),
    item({ id: 'x2', intitule: 'Incident RH sans rapport' }),
    item({ id: 'x3', intitule: 'Panne du portail client', statut: 'REJETE' }), // rejeté → ignoré
  ]
  it('retourne les doublons probables triés par score décroissant, hors self et REJETE', () => {
    const dups = findIncidentDuplicates(candidate, existing)
    expect(dups.map(d => d.id)).toEqual(['x1'])
    expect(dups[0].score).toBeGreaterThanOrEqual(0.5)
  })
  it('exclut la même id (édition d’un incident existant)', () => {
    const self = item({ id: 'x1', intitule: 'Panne portail client' })
    expect(findIncidentDuplicates(self, existing).map(d => d.id)).not.toContain('x1')
  })
  it('aucun doublon si rien ne dépasse le seuil', () => {
    expect(findIncidentDuplicates(item({ id: 'z', intitule: 'Sujet totalement unique xyz' }), existing)).toEqual([])
  })
})

describe('findDuplicatesForAll', () => {
  // Le batch tokenise chaque titre UNE fois (O(n)) au lieu de re-tokeniser à chaque
  // paire (O(n²)) : le résultat doit être IDENTIQUE au calcul item par item.
  const items: IncidentDedupItem[] = [
    item({ id: 'a', intitule: 'Panne du service de paiement', dateSurvenance: '2026-03-01', processusId: 'p1' }),
    item({ id: 'b', intitule: 'Panne service de paiement', dateSurvenance: '2026-03-01', processusId: 'p1' }),
    item({ id: 'c', intitule: 'Incident RH sans rapport' }),
    item({ id: 'd', intitule: 'Panne du service de paiement', statut: 'REJETE' }),
  ]
  it('équivaut, pour chaque item, à findIncidentDuplicates', () => {
    const all = findDuplicatesForAll(items)
    for (const it of items) {
      expect(all.get(it.id)).toEqual(findIncidentDuplicates(it, items))
    }
  })
  it('exclut self et les doublons REJETE de la liste des matches', () => {
    const all = findDuplicatesForAll(items)
    expect(all.get('a')!.map(d => d.id)).toEqual(['b'])   // 'd' (REJETE) et self exclus
  })
})
