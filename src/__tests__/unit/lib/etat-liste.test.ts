// n° 43 (recette 2026-10-12) : pendant le rechargement qui suit un enregistrement, une liste
// ne doit ni afficher « Aucun … » (alors qu'un élément vient d'être créé) ni un compteur périmé :
// état « Chargement… » / « Mise à jour… », et l'élément enregistré est intégré tout de suite.
import { describe, expect, it } from 'vitest'
import { etatListe, fusionnerEnregistrement } from '@/lib/etat-liste'

describe('etatListe', () => {
  it('liste vide en cours de chargement : « chargement » (pas « vide »)', () => {
    expect(etatListe(0, true)).toBe('chargement')
    expect(etatListe(0, false)).toBe('vide')
  })
  it('liste non vide en cours de rechargement : « miseAJour » ; sinon « liste »', () => {
    expect(etatListe(3, true)).toBe('miseAJour')
    expect(etatListe(3, false)).toBe('liste')
  })
})

describe('fusionnerEnregistrement', () => {
  const l = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }]
  it('création : l\'élément est ajouté en tête', () => {
    expect(fusionnerEnregistrement(l, { id: 'c', v: 3 })).toEqual([{ id: 'c', v: 3 }, ...l])
  })
  it('modification : l\'élément est remplacé à sa place', () => {
    expect(fusionnerEnregistrement(l, { id: 'b', v: 9 })).toEqual([{ id: 'a', v: 1 }, { id: 'b', v: 9 }])
  })
  it('réponse sans identifiant : liste inchangée (le rechargement fera foi)', () => {
    expect(fusionnerEnregistrement(l, { error: 'x' } as never)).toBe(l)
  })
})
