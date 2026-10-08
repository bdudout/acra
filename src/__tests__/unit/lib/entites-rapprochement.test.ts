import { describe, it, expect } from 'vitest'
import { regrouperValeurs, proposerRapprochements, planifierRapprochement } from '@/lib/entites-rapprochement'
import type { EntiteRef } from '@/lib/entites'

const E = (id: string, nom: string, o: Partial<EntiteRef> = {}): EntiteRef => ({ id, nom, type: 'DIRECTION', alias: [], codeExterne: null, parentId: null, source: 'MANUEL', valideAu: null, ...o })
const entites = [
  E('dsi', 'Direction des systèmes d’information', { alias: ['DSI'] }),
  E('rh', 'Ressources humaines'),
  E('old', 'Site Lyon', { valideAu: new Date('2020-01-01') }),
]

describe('regrouperValeurs', () => {
  it('regroupe les variantes d’espaces, de casse et d’accents, ignore les vides, compte par source, trie par fréquence', () => {
    const v = regrouperValeurs([
      { source: 'risques', valeur: 'DSI', n: 3 },
      { source: 'incidents', valeur: ' DSI ', n: 1 },
      { source: 'incidents', valeur: 'dsi', n: 1 },
      { source: 'risques', valeur: 'Achats', n: 1 },
      { source: 'conformites', valeur: '', n: 9 },
      { source: 'mesures', valeur: '   ', n: 4 },
    ])
    expect(v).toEqual([
      { valeur: 'DSI', total: 5, occurrences: { risques: 3, incidents: 2 }, brutes: ['DSI', ' DSI ', 'dsi'] },
      { valeur: 'Achats', total: 1, occurrences: { risques: 1 }, brutes: ['Achats'] },
    ])
  })
  it('libellé affiché : la variante la plus fréquente', () => {
    expect(regrouperValeurs([{ source: 'risques', valeur: 'dsi', n: 1 }, { source: 'mesures', valeur: 'DSI', n: 4 }])[0].valeur).toBe('DSI')
  })
})

describe('proposerRapprochements', () => {
  it('exacte (nom, alias), proche (faute), aucune ; entités closes jamais proposées', () => {
    const p = proposerRapprochements(regrouperValeurs([
      { source: 'risques', valeur: 'dsi', n: 1 },
      { source: 'risques', valeur: 'Ressource humaine', n: 1 },
      { source: 'risques', valeur: 'Site Lyon', n: 1 },
      { source: 'risques', valeur: 'Logistique', n: 1 },
    ]), entites)
    const par = Object.fromEntries(p.map(x => [x.valeur, [x.niveau, x.suggestion?.id]]))
    expect(par).toEqual({ dsi: ['EXACTE', 'dsi'], 'Ressource humaine': ['PROCHE', 'rh'], 'Site Lyon': ['AUCUNE', undefined], Logistique: ['AUCUNE', undefined] })
  })
})

describe('planifierRapprochement', () => {
  const propositions = proposerRapprochements(regrouperValeurs([
    { source: 'risques', valeur: 'Direction SI', n: 2 },
    { source: 'mesures', valeur: 'DSI', n: 1 },
    { source: 'incidents', valeur: 'Juridique', n: 1 },
  ]), entites)

  it('lien vers une entité : variante ajoutée en alias si elle n’est ni le nom ni un alias existant', () => {
    const p = planifierRapprochement([{ valeur: 'Direction SI', entiteId: 'dsi' }, { valeur: 'DSI', entiteId: 'dsi' }], propositions, entites)
    expect(p.erreur).toBeUndefined()
    expect(p.liens).toEqual([
      { brutes: ['Direction SI'], entiteId: 'dsi' },
      { brutes: ['DSI'], entiteId: 'dsi' },
    ])
    expect(p.aliasAjoutes).toEqual({ dsi: ['Direction SI'] })
  })

  it('création d’une entité à partir d’une valeur', () => {
    const p = planifierRapprochement([{ valeur: 'Juridique', creer: 'SERVICE' }], propositions, entites)
    expect(p.creations).toEqual([{ nom: 'Juridique', type: 'SERVICE', brutes: ['Juridique'] }])
  })

  it('refuse une valeur inconnue, une entité hors référentiel ou close, un type invalide', () => {
    expect(planifierRapprochement([{ valeur: 'Inconnue', entiteId: 'dsi' }], propositions, entites).erreur).toBe('valeur_inconnue')
    expect(planifierRapprochement([{ valeur: 'DSI', entiteId: 'autre' }], propositions, entites).erreur).toBe('entite_invalide')
    expect(planifierRapprochement([{ valeur: 'DSI', entiteId: 'old' }], propositions, entites).erreur).toBe('entite_invalide')
    expect(planifierRapprochement([{ valeur: 'Juridique', creer: 'PLANETE' }], propositions, entites).erreur).toBe('type_invalide')
  })
})
