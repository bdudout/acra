// n° 51 (recette 2026-10-12) : la phase 1 ISO 27005 / NIST affiche le critère
// d'acceptation RÉELLEMENT appliqué en phase d'évaluation (le même que evaluateRisk),
// au lieu d'un champ libre « critères » ignoré : appétit de l'organisation (global,
// + seuils par catégorie), sinon moitié haute des paliers de l'échelle.
import { describe, expect, it } from 'vitest'
import { resolveScaleConfig } from '@/lib/risk-scale'
import { APPETIT_DEFAULT } from '@/lib/appetit'
import { critereAcceptation, evaluateRisk } from '@/lib/risque-priorisation'

const S4 = resolveScaleConfig(null)
const S5 = resolveScaleConfig({ nbNiveaux: 5 })

describe('critereAcceptation', () => {
  it('appétit global défini : seuil global et nombre de seuils par catégorie', () => {
    expect(critereAcceptation({ scale: S4, appetit: { seuilGlobal: 9, parCategorie: { CYBER: 6, FRAUDE: 4 } } }))
      .toEqual({ basis: 'APPETIT', seuil: 9, nbCategories: 2 })
  })
  it('sans appétit : paliers de la moitié haute de l\'échelle (à traiter), dans l\'ordre croissant', () => {
    expect(critereAcceptation({ scale: S4, appetit: APPETIT_DEFAULT })).toEqual({ basis: 'ECHELLE', aTraiter: ['Élevé', 'Critique'] })
    const c5 = critereAcceptation({ scale: S5, appetit: APPETIT_DEFAULT })
    expect(c5.basis).toBe('ECHELLE')
    if (c5.basis === 'ECHELLE') expect(c5.aTraiter.length).toBe(Math.floor(S5.seuilsMatrice.length / 2))
  })
  it('cohérent avec evaluateRisk : sans appétit, un risque d\'un palier listé est à traiter', () => {
    const ctx = { scale: S4, appetit: APPETIT_DEFAULT }
    const c = critereAcceptation(ctx)
    const e = evaluateRisk({ gravite: 4, vraisemblance: 3, niveauRisque: 12 }, ctx)
    expect(c.basis === 'ECHELLE' && c.aTraiter.includes(e.seuil.label)).toBe(e.decision === 'treat')
  })
  it('appétit uniquement par catégorie : critère « appétit » sans seuil global', () => {
    expect(critereAcceptation({ scale: S4, appetit: { seuilGlobal: null, parCategorie: { CYBER: 6 } } }))
      .toEqual({ basis: 'APPETIT', seuil: null, nbCategories: 1 })
  })
})
