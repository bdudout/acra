/** Lien de l'e-mail de relance : l'objet concerné quand il est connu, sinon la page de la catégorie. */
import { describe, expect, it } from 'vitest'
import { cheminRelance } from '@/lib/relances-chemins'

describe('cheminRelance', () => {
  it('projet à approuver : la page du projet ; sinon la page de la catégorie', () => {
    expect(cheminRelance({ categorie: 'PROJET360_A_APPROUVER', chemin: '/projets/p1' })).toBe('/projets/p1')
    expect(cheminRelance({ categorie: 'PROJET360_A_APPROUVER' })).toBe('/projets')
    expect(cheminRelance({ categorie: 'PLAN_ACTION' })).toBe('/plans-actions')
  })
  it('n’accepte qu’un chemin interne', () => {
    expect(cheminRelance({ categorie: 'PROJET360_A_APPROUVER', chemin: 'https://exemple.test/x' })).toBe('/projets')
    expect(cheminRelance({ categorie: 'PROJET360_A_APPROUVER', chemin: '//exemple.test' })).toBe('/projets')
  })
})
