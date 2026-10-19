import { describe, it, expect } from 'vitest'
import { lireFiltresActions, listerActionsPage, lireColonnes, ecrireColonnes, prioriteDepuisUrl, echeanceDepuisUrl, valeurColonne, cleTriAction, TRIS_ACTIONS } from '@/lib/action-items-liste'
import { lirePagination } from '@/lib/pagination'
import type { ActionItem } from '@/lib/action-items'

const now = new Date('2026-06-01T00:00:00Z')
const mk = (p: Partial<ActionItem>): ActionItem => ({
  id: p.id ?? 'x', source: 'MESURE', origine: 'risque', sourceId: p.id ?? 'x', titre: 't', description: null, porteur: null,
  entite: null, entiteId: null, echeance: null, statut: 'A_FAIRE', priorite: 'MAJEUR', lien: null, riskItemId: null, ...p,
})
const items = [
  mk({ id: 'a', titre: 'Chiffrer', priorite: 'CRITIQUE', porteur: 'DSI' }),
  mk({ id: 'b', titre: 'Revue', origine: 'audit', priorite: 'MODERE', statut: 'FAIT', porteur: 'Audit' }),
  mk({ id: 'c', titre: 'Fuite', origine: 'incident', porteur: 'RSSI', echeance: new Date('2020-01-01') }),
  mk({ id: 'd', titre: 'Isolée', origine: 'orpheline' }),
]
const page = (q: string) => {
  const sp = new URLSearchParams(q)
  const pg = lirePagination(sp, { tris: TRIS_ACTIONS, triDefaut: 'defaut' })!
  const f = lireFiltresActions(sp)
  f.filtre.q = pg.q || undefined
  return listerActionsPage(items, f, pg, [], now)
}

describe('action-items-liste (vue unifiée paginée côté serveur)', () => {
  it('deep-links historiques : priorite=1|2|3 et filtre=retard', () => {
    expect(prioriteDepuisUrl('1')).toBe('CRITIQUE')
    expect(prioriteDepuisUrl('3')).toBe('MODERE')
    expect(prioriteDepuisUrl('MAJEUR')).toBe('MAJEUR')
    expect(prioriteDepuisUrl('x')).toBe('')
    expect(echeanceDepuisUrl(new URLSearchParams('filtre=retard'))).toBe('retard')
    expect(echeanceDepuisUrl(new URLSearchParams('echeance=mois&filtre=retard'))).toBe('mois')
    expect(echeanceDepuisUrl(new URLSearchParams('echeance=nimporte'))).toBe('')
    expect(lireFiltresActions(new URLSearchParams('origine=pirate&statut=EN_RETARD')).filtre).toEqual({ statut: 'EN_RETARD' })
  })

  it('filtres de colonne : aller-retour JSON, entrée invalide ignorée', () => {
    const c = lireColonnes(ecrireColonnes({ origine: new Set(['audit']), autre: new Set(['x']) }))
    expect(Object.keys(c)).toEqual(['origine'])
    expect([...c.origine]).toEqual(['audit'])
    expect(lireColonnes('{pas du json')).toEqual({})
    expect(lireColonnes('[1]')).toEqual({})
    expect(ecrireColonnes({})).toBeNull()
  })

  it('valeurs et clés de colonne : codes, statut effectif, rangs métier', () => {
    expect(valeurColonne(items[2], 'statut', now)).toBe('EN_RETARD')
    expect(valeurColonne(items[0], 'porteur', now)).toBe('DSI')
    expect(cleTriAction(items[0], 'priorite', now)).toBe(0)
    expect(cleTriAction(items[2], 'statut', now)).toBe(0)
  })

  it('page, compteurs sur TOUTES les actions, valeurs distinctes après facettes', () => {
    const r = page('page=1&taille=25&origine=risque')
    expect(r.items.map(i => i.id)).toEqual(['a'])
    expect(r.pagination).toEqual({ page: 1, taille: 25, total: 1, pages: 1 })
    expect(r.synthese).toMatchObject({ total: 4, faits: 1, enRetard: 1, tauxAvancement: 25, orphelines: 1 })
    expect(r.valeurs.origine).toEqual(['risque'])
    expect(page('page=1').valeurs.statut).toEqual(['A_FAIRE', 'EN_RETARD', 'FAIT'])
  })

  it('tri métier par défaut (retards puis priorité), tri par colonne, recherche et filtre de colonne', () => {
    expect(page('page=1').items.map(i => i.id)).toEqual(['c', 'a', 'd', 'b'])
    expect(page('page=1&tri=porteur&ordre=asc').items.map(i => i.id)).toEqual(['b', 'a', 'c', 'd']) // vides en fin
    expect(page('page=1&q=revue').items.map(i => i.id)).toEqual(['b'])
    expect(page(`page=1&col=${encodeURIComponent(JSON.stringify({ origine: ['audit', 'incident'] }))}`).items.map(i => i.id)).toEqual(['c', 'b'])
  })

  it('taille de page respectée et page ramenée dans les bornes', () => {
    const many = Array.from({ length: 60 }, (_, i) => mk({ id: `n${i}` }))
    const sp = new URLSearchParams('page=9&taille=25')
    const r = listerActionsPage(many, lireFiltresActions(sp), lirePagination(sp, { tris: TRIS_ACTIONS, triDefaut: 'defaut' })!, [], now)
    expect(r.items).toHaveLength(10)
    expect(r.pagination).toEqual({ page: 3, taille: 25, total: 60, pages: 3 })
  })
})
