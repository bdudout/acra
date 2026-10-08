import { describe, it, expect } from 'vitest'
import { resoudreEntite, perimetreEntite, filtrerParEntite, optionsEntites } from '@/lib/entites-filtre'
import type { EntiteRef } from '@/lib/entites'

const E = (id: string, nom: string, o: Partial<EntiteRef> = {}): EntiteRef => ({ id, nom, type: 'DIRECTION', alias: [], codeExterne: null, parentId: null, source: 'MANUEL', valideAu: null, ...o })
const entites = [
  E('g', 'Groupe', { type: 'FILIALE' }),
  E('dsi', 'Direction des systèmes d’information', { parentId: 'g', alias: ['DSI'] }),
  E('ret', 'Réseaux et télécoms', { parentId: 'dsi' }),
  E('rh', 'Ressources humaines', { parentId: 'g' }),
  E('old', 'Ancienne DSI', { valideAu: new Date('2020-01-01') }),
]

describe('resoudreEntite', () => {
  it('lien du référentiel d’abord, sinon texte libre identique (nom ou alias), sinon rien', () => {
    expect(resoudreEntite('rh', 'DSI', entites)).toBe('rh')
    expect(resoudreEntite(null, ' dsi ', entites)).toBe('dsi')
    expect(resoudreEntite(null, 'Direction SI', entites)).toBeNull() // proche mais pas identique : pas de supposition
    expect(resoudreEntite(null, null, entites)).toBeNull()
  })
})

describe('perimetreEntite', () => {
  it('entité seule ou avec ses sous-entités', () => {
    expect([...perimetreEntite(entites, 'dsi', false)]).toEqual(['dsi'])
    expect([...perimetreEntite(entites, 'g', true)].sort()).toEqual(['dsi', 'g', 'ret', 'rh'])
  })
})

describe('filtrerParEntite', () => {
  const items = [
    { id: 1, entiteId: 'ret', entite: null },
    { id: 2, entiteId: null, entite: 'DSI' },
    { id: 3, entiteId: null, entite: 'Achats' },
    { id: 4, entiteId: 'rh', entite: 'DSI' },
  ]
  it('garde les objets rattachés au périmètre (lien ou texte identique), sous-entités comprises', () => {
    expect(filtrerParEntite(items, entites, 'dsi', true).map(i => i.id)).toEqual([1, 2])
    expect(filtrerParEntite(items, entites, 'dsi', false).map(i => i.id)).toEqual([2])
    expect(filtrerParEntite(items, entites, 'g', true).map(i => i.id)).toEqual([1, 2, 4])
  })
  it('sans entité choisie : tout passe', () => {
    expect(filtrerParEntite(items, entites, '', true)).toHaveLength(4)
  })
})

describe('optionsEntites', () => {
  it('liste hiérarchique indentée, entités closes exclues', () => {
    expect(optionsEntites(entites).map(o => [o.id, o.niveau])).toEqual([['g', 0], ['dsi', 1], ['ret', 2], ['rh', 1]])
  })
})
