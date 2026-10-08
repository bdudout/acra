import { describe, it, expect } from 'vitest'
import { planifierReorganisation, entiteALaDate, type Evenement } from '@/lib/entites-reorganisation'
import type { EntiteRef } from '@/lib/entites'

const E = (id: string, nom: string, o: Partial<EntiteRef> = {}): EntiteRef => ({ id, nom, type: 'DIRECTION', alias: [], codeExterne: null, parentId: null, source: 'MANUEL', valideAu: null, ...o })
const entites = [
  E('a', 'Achats'), E('b', 'Approvisionnements', { alias: ['APPRO'] }), E('c', 'Comptabilité'),
  E('a1', 'Achats IT', { parentId: 'a' }), E('x', 'Ancienne', { valideAu: new Date('2020-01-01') }),
]
const date = '2026-10-01'

describe('planifierReorganisation', () => {
  it('renommage : nouveau nom, ancien nom gardé en alias, aucune référence déplacée', () => {
    const p = planifierReorganisation({ type: 'RENOMMAGE', dateEffet: date, sources: ['a'], nouveauNom: 'Achats groupe' }, entites)
    expect(p).toMatchObject({ ok: true, renommage: { id: 'a', nom: 'Achats groupe', alias: ['Achats'] }, transferts: [], clore: [] })
  })

  it('fusion dans une entité existante : sources closes, références et sous-entités vers la cible, noms absorbés en alias', () => {
    const p = planifierReorganisation({ type: 'FUSION', dateEffet: date, sources: ['a', 'b'], cible: { id: 'b' } }, entites)
    expect(p).toMatchObject({ ok: true, transferts: [{ de: 'a', vers: { id: 'b' } }], clore: ['a'], aliasAjoutes: { b: ['Achats'] } })
    expect(p.ok && p.sousEntites).toEqual([{ de: 'a', vers: { id: 'b' } }])
  })

  it('fusion dans une nouvelle entité : créée, toutes les sources closes', () => {
    const p = planifierReorganisation({ type: 'FUSION', dateEffet: date, sources: ['a', 'b'], cible: { nom: 'Achats et appro', type: 'DIRECTION' } }, entites)
    expect(p).toMatchObject({ ok: true, creations: [{ nom: 'Achats et appro', type: 'DIRECTION', parentId: null, alias: ['Achats', 'Approvisionnements'] }], clore: ['a', 'b'] })
    expect(p.ok && p.transferts).toEqual([{ de: 'a', vers: { creation: 0 } }, { de: 'b', vers: { creation: 0 } }])
  })

  it('scission avec clôture : nouvelles entités au même rattachement, références vers le repreneur', () => {
    const p = planifierReorganisation({ type: 'SCISSION', dateEffet: date, sources: ['a1'], nouvelles: [{ nom: 'Achats logiciels', type: 'SERVICE' }, { nom: 'Achats matériels', type: 'SERVICE' }], repreneur: 1 }, entites)
    expect(p).toMatchObject({ ok: true, clore: ['a1'], transferts: [{ de: 'a1', vers: { creation: 1 } }] })
    expect(p.ok && p.creations.map(c => c.parentId)).toEqual(['a', 'a'])
  })

  it('scission avec conservation de la source (essaimage) : rien n’est déplacé ni clos', () => {
    const p = planifierReorganisation({ type: 'SCISSION', dateEffet: date, sources: ['a'], nouvelles: [{ nom: 'Achats indirects', type: 'DIRECTION' }], repreneur: null }, entites)
    expect(p).toMatchObject({ ok: true, clore: [], transferts: [] })
  })

  it('clôture avec successeur : références et sous-entités transférées ; sans successeur : références conservées', () => {
    expect(planifierReorganisation({ type: 'CLOTURE', dateEffet: date, sources: ['a'], successeur: 'c' }, entites))
      .toMatchObject({ ok: true, clore: ['a'], transferts: [{ de: 'a', vers: { id: 'c' } }], sousEntites: [{ de: 'a', vers: { id: 'c' } }] })
    expect(planifierReorganisation({ type: 'CLOTURE', dateEffet: date, sources: ['c'] }, entites)).toMatchObject({ ok: true, clore: ['c'], transferts: [] })
  })

  it('refus expliqués', () => {
    const r = (o: object) => { const p = planifierReorganisation({ dateEffet: date, ...o } as never, entites); return p.ok ? 'ok' : p.error }
    expect(r({ type: 'FUSION', sources: ['a'], cible: { id: 'b' } })).toBe('sources_insuffisantes')
    expect(r({ type: 'FUSION', sources: ['a', 'x'], cible: { id: 'b' } })).toBe('source_invalide') // close
    expect(r({ type: 'FUSION', sources: ['a', 'b'], cible: { id: 'x' } })).toBe('cible_invalide')
    expect(r({ type: 'RENOMMAGE', sources: ['a'], nouveauNom: ' ' })).toBe('nom_requis')
    expect(r({ type: 'SCISSION', sources: ['a'], nouvelles: [], repreneur: null })).toBe('nouvelles_requises')
    expect(r({ type: 'SCISSION', sources: ['a'], nouvelles: [{ nom: 'X', type: 'SITE' }], repreneur: 3 })).toBe('repreneur_invalide')
    expect(r({ type: 'CLOTURE', sources: ['a'], successeur: 'a' })).toBe('cible_invalide')
    expect(r({ type: 'CLOTURE', sources: ['a'], successeur: 'a1' })).toBe('cible_invalide') // sa propre sous-entité
    expect(r({ type: 'RENOMMAGE', sources: ['a'], nouveauNom: 'Y', dateEffet: 'pas une date' })).toBe('date_invalide')
  })
})

describe('entiteALaDate', () => {
  const evts: Evenement[] = [
    { dateEffet: new Date('2026-01-01'), objets: { a: { risques: ['r1'] }, b: { risques: ['r2'] } } }, // fusion a + b → c
    { dateEffet: new Date('2027-06-01'), objets: { c: { risques: ['r1'] } } }, // c clos → d
  ]
  it('remonte les transferts postérieurs à la date demandée', () => {
    expect(entiteALaDate('d', 'risques', 'r1', evts, new Date('2025-06-01'))).toBe('a')
    expect(entiteALaDate('d', 'risques', 'r1', evts, new Date('2026-06-01'))).toBe('c')
    expect(entiteALaDate('d', 'risques', 'r1', evts, new Date('2027-07-01'))).toBe('d')
    expect(entiteALaDate('c', 'risques', 'r2', evts, new Date('2025-06-01'))).toBe('b')
    expect(entiteALaDate('c', 'incidents', 'r2', evts, new Date('2025-06-01'))).toBe('c') // autre type d'objet
  })
})
