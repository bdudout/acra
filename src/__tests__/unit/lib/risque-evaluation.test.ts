// P1/P2 de l'audit des méthodes directes : échelle de l'ORGANISATION (4 ou 5
// niveaux, seuils, matrice qualitative) et évaluation sur le niveau ACTUEL
// comparé à l'appétit (par catégorie, sinon global), repli sur l'échelle.
import { describe, expect, it } from 'vitest'
import { resolveScaleConfig, type ScaleConfig } from '@/lib/risk-scale'
import { APPETIT_DEFAULT } from '@/lib/appetit'
import { evaluatedLevel, evaluateRisk, prioritiseRisks, countRiskDecisions, scaleLevels } from '@/lib/risque-priorisation'

const S4 = resolveScaleConfig(null)
const S5 = resolveScaleConfig({ nbNiveaux: 5 })
const row = (o: Record<string, unknown> = {}) => ({ gravite: 4, vraisemblance: 3, niveauRisque: 12, taxonomieCode: null, ...o })

describe('scaleLevels', () => {
  it('suit le nombre de niveaux configuré par l’organisation', () => {
    expect(scaleLevels(S4)).toEqual([1, 2, 3, 4])
    expect(scaleLevels(S5)).toEqual([1, 2, 3, 4, 5])
  })
})

describe('evaluatedLevel', () => {
  it('évalue le niveau ACTUEL (mesures existantes), repli sur le brut', () => {
    expect(evaluatedLevel(row({ graviteActuelle: 2, vraisemblanceActuelle: 3, niveauActuel: 6 }))).toEqual({ gravite: 2, vraisemblance: 3, niveau: 6 })
    expect(evaluatedLevel(row())).toEqual({ gravite: 4, vraisemblance: 3, niveau: 12 })
  })
})

describe('evaluateRisk', () => {
  it('sans appétit : moitié haute des paliers de l’échelle = à traiter (Élevé, Critique en défaut)', () => {
    expect(evaluateRisk(row(), { scale: S4, appetit: APPETIT_DEFAULT })).toMatchObject({ decision: 'treat', basis: 'ECHELLE', niveau: 12, seuil: { label: 'Critique' } })
    expect(evaluateRisk(row({ gravite: 2, vraisemblance: 2, niveauRisque: 4 }), { scale: S4, appetit: APPETIT_DEFAULT })).toMatchObject({ decision: 'accept', seuil: { label: 'Modéré' } })
  })

  it('le brut élevé mais l’actuel faible (mesures en place) → acceptable', () => {
    const r = row({ graviteActuelle: 1, vraisemblanceActuelle: 3, niveauActuel: 3 })
    expect(evaluateRisk(r, { scale: S4, appetit: APPETIT_DEFAULT })).toMatchObject({ decision: 'accept', niveau: 3 })
  })

  it('appétit global défini : prioritaire sur l’échelle (au-delà du seuil = à traiter, seuil inclus acceptable)', () => {
    const appetit = { seuilGlobal: 6, parCategorie: {} }
    expect(evaluateRisk(row({ gravite: 3, vraisemblance: 2, niveauRisque: 6 }), { scale: S4, appetit })).toMatchObject({ decision: 'accept', basis: 'APPETIT', seuilAppetit: 6 })
    expect(evaluateRisk(row({ gravite: 2, vraisemblance: 4, niveauRisque: 8 }), { scale: S4, appetit })).toMatchObject({ decision: 'treat', basis: 'APPETIT' })
  })

  it('appétit par catégorie prioritaire sur le global', () => {
    const appetit = { seuilGlobal: 4, parCategorie: { CYBER: 12 } }
    expect(evaluateRisk(row({ taxonomieCode: 'CYBER' }), { scale: S4, appetit })).toMatchObject({ decision: 'accept', seuilAppetit: 12 })
    expect(evaluateRisk(row({ taxonomieCode: 'RH' }), { scale: S4, appetit })).toMatchObject({ decision: 'treat', seuilAppetit: 4 })
  })

  it('matrice qualitative de l’organisation : le palier vient de la case, pas du produit', () => {
    const scale: ScaleConfig = { ...S4, matriceMode: 'QUALITATIVE', matriceQualitative: [{ gravite: 4, vraisemblance: 3, seuilLabel: 'Modéré' }] }
    expect(evaluateRisk(row(), { scale, appetit: APPETIT_DEFAULT })).toMatchObject({ decision: 'accept', seuil: { label: 'Modéré' } })
  })

  it('échelle à 5 paliers : les deux plus hauts sont à traiter', () => {
    const scale: ScaleConfig = { ...S5, seuilsMatrice: [
      { scoreMin: 1, scoreMax: 2, label: 'Très faible', couleur: '#16a34a' }, { scoreMin: 3, scoreMax: 5, label: 'Faible', couleur: '#22c55e' },
      { scoreMin: 6, scoreMax: 9, label: 'Modéré', couleur: '#f59e0b' }, { scoreMin: 10, scoreMax: 15, label: 'Élevé', couleur: '#f97316' },
      { scoreMin: 16, scoreMax: 25, label: 'Très élevé', couleur: '#ef4444' },
    ] }
    expect(evaluateRisk(row({ gravite: 3, vraisemblance: 3, niveauRisque: 9 }), { scale, appetit: APPETIT_DEFAULT }).decision).toBe('accept')
    expect(evaluateRisk(row({ gravite: 5, vraisemblance: 2, niveauRisque: 10 }), { scale, appetit: APPETIT_DEFAULT }).decision).toBe('treat')
  })
})

describe('prioritiseRisks / countRiskDecisions', () => {
  it('trie par niveau évalué décroissant et compte les décisions', () => {
    const rows = [
      row({ id: 'a', gravite: 1, vraisemblance: 2, niveauRisque: 2 }),
      row({ id: 'b', niveauRisque: 12, graviteActuelle: 2, vraisemblanceActuelle: 2, niveauActuel: 4 }),
      row({ id: 'c', gravite: 3, vraisemblance: 3, niveauRisque: 9 }),
    ]
    const ctx = { scale: S4, appetit: APPETIT_DEFAULT }
    expect(prioritiseRisks(rows, ctx).map(p => (p.row as unknown as { id: string }).id)).toEqual(['c', 'b', 'a'])
    expect(countRiskDecisions(rows, ctx)).toEqual({ treat: 1, accept: 2 })
  })
})
