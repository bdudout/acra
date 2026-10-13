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
  it('recette n° 21 : évaluations et revues de tiers → entités de tiers (pas les parties prenantes d’analyses)', () => {
    for (const categorie of ['EVALUATION_TIERS_A_VALIDER', 'EVALUATION_TIERS_A_REVOIR', 'REVUE_TIERS'] as const) expect(cheminRelance({ categorie })).toBe('/tiers/entites')
    expect(cheminRelance({ categorie: 'EVALUATION_TIERS_A_VALIDER', chemin: '/tiers/entites?tier=t1' })).toBe('/tiers/entites?tier=t1')
  })
  it('recette n° 45 : incident à qualifier → l’incident ; KRI en alerte → KRI filtrés sur l’alerte', () => {
    expect(cheminRelance({ categorie: 'INCIDENT_A_QUALIFIER' })).toBe('/incidents')
    expect(cheminRelance({ categorie: 'INCIDENT_A_QUALIFIER', chemin: '/incidents?incident=i1' })).toBe('/incidents?incident=i1')
    expect(cheminRelance({ categorie: 'KRI_ALERTE' })).toBe('/kri?statut=ALERTE')
  })
})
