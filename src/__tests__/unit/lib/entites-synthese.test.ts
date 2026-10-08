import { describe, it, expect } from 'vitest'
import { repartirParEntite, syntheseParEntite } from '@/lib/entites-synthese'
import type { EntiteRef } from '@/lib/entites'

const E = (id: string, nom: string, o: Partial<EntiteRef> = {}): EntiteRef => ({ id, nom, type: 'DIRECTION', alias: [], codeExterne: null, parentId: null, source: 'MANUEL', valideAu: null, ...o })
const entites = [
  E('g', 'Groupe', { type: 'FILIALE' }),
  E('dsi', 'DSI', { parentId: 'g' }),
  E('ret', 'Réseaux', { parentId: 'dsi' }),
  E('rh', 'RH', { parentId: 'g' }),
  E('old', 'Ancien site', { valideAu: new Date('2020-01-01') }),
]

describe('repartirParEntite', () => {
  const items = [
    { id: 1, entiteId: 'ret', entite: null },
    { id: 2, entiteId: null, entite: 'DSI' },
    { id: 3, entiteId: null, entite: 'Achats' },
    { id: 4, entiteId: 'rh', entite: null },
    { id: 5, entiteId: null, entite: null },
  ]
  it('chaque entité active cumule ses objets et ceux de ses sous-entités, dans l’ordre de l’arbre ; le reste est « non rattaché »', () => {
    const r = repartirParEntite(entites, items, x => x)
    expect(r.lignes.map(l => [l.id, l.niveau, l.items.map(i => i.id)])).toEqual([
      ['g', 0, [1, 2, 4]], ['dsi', 1, [1, 2]], ['ret', 2, [1]], ['rh', 1, [4]],
    ])
    expect(r.nonRattaches.map(i => i.id)).toEqual([3, 5])
  })
  it('un objet lié à une entité close n’est pas perdu : il compte comme non rattaché', () => {
    const r = repartirParEntite(entites, [{ entiteId: 'old', entite: null }], x => x)
    expect(r.lignes.every(l => l.items.length === 0)).toBe(true)
    expect(r.nonRattaches).toHaveLength(1)
  })
  it('un ancêtre clos est traversé : le grand-parent actif cumule quand même', () => {
    const ents = [E('g', 'Groupe'), E('mid', 'Pôle clos', { parentId: 'g', valideAu: new Date('2020-01-01') }), E('f', 'Feuille', { parentId: 'mid' })]
    const r = repartirParEntite(ents, [{ entiteId: 'f', entite: null }], x => x)
    expect(r.lignes.find(l => l.id === 'g')!.items).toHaveLength(1)
  })
})

describe('syntheseParEntite (tableaux de bord)', () => {
  const now = new Date('2026-10-09')
  const r = (id: string, o: Record<string, unknown>) => ({ id, organizationId: 'o1', niveauInherent: null, niveauResiduel: null, entiteId: null, entite: null, ...o })
  const risques = [
    r('r1', { entiteId: 'ret', niveauResiduel: 16 }),  // élevé
    r('r2', { entite: 'dsi', niveauResiduel: 2 }),
    r('r3', { entiteId: 'rh' }),
    r('r4', {}),
  ]
  const actions = [
    { risqueId: 'r1', organizationId: 'o1', statut: 'A_FAIRE', echeance: '2026-01-01' }, // en retard
    { risqueId: 'r3', organizationId: 'o1', statut: 'FAIT', echeance: '2026-01-01' },
  ]
  const incidents = [
    { organizationId: 'o1', statut: 'DECLARE' as const, montantBrut: 1000, recuperations: 200, entiteId: 'dsi', entite: null },
    { organizationId: 'o1', statut: 'REJETE' as const, montantBrut: 5000, recuperations: null, entiteId: 'dsi', entite: null },
  ]
  it('indicateurs par entité, sous-entités cumulées ; entités sans objet omises ; reste « non rattaché »', () => {
    const s = syntheseParEntite({ entites, risques, actions, incidents, now })
    expect(s.lignes.map(l => [l.id, l.niveau, l.risques.total, l.risques.eleve, l.actionsEnRetard, l.incidents?.ouverts, l.incidents?.perteNette])).toEqual([
      ['g', 0, 3, 1, 1, 1, 800], ['dsi', 1, 2, 1, 1, 1, 800], ['ret', 2, 1, 1, 1, 0, 0], ['rh', 1, 1, 0, 0, 0, 0],
    ])
    expect(s.nonRattache).toMatchObject({ risques: { total: 1 }, actionsEnRetard: 0 })
  })
  it('sans module incidents : pas d’indicateur incidents', () => {
    expect(syntheseParEntite({ entites, risques, actions, now }).lignes[0].incidents).toBeUndefined()
  })
})
