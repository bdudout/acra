import { describe, it, expect } from 'vitest'
import { completionRatio, risqueADate, type RiskLike, type MeasureLike } from '@/lib/risk-current'

// ─────────────────────────────────────────────────────────────────────────────
// Matrice des risques « à date » : position courante interpolée entre le risque
// brut et le risque résiduel cible, selon l'avancement réel du plan d'action
// (proportion de mesures REALISE parmi les mesures liées au risque).
// ─────────────────────────────────────────────────────────────────────────────

const mesures: MeasureLike[] = [
  { risqueId: 'r1', statut: 'REALISE' },
  { risqueId: 'r1', statut: 'REALISE' },
  { risqueId: 'r1', statut: 'A_FAIRE' },
  { risqueId: 'r1', statut: 'EN_COURS' }, // EN_COURS = non fait (option retenue)
  { risqueId: 'r2', statut: 'REALISE' },
  { risqueId: 'r2', statut: 'REALISE' },
]

describe('completionRatio — proportion de mesures réalisées', () => {
  it('compte REALISE / total des mesures liées', () => {
    expect(completionRatio('r1', mesures)).toBeCloseTo(2 / 4) // 2 REALISE sur 4
    expect(completionRatio('r2', mesures)).toBe(1)            // 2/2
  })
  it('0 si aucune mesure liée', () => {
    expect(completionRatio('rX', mesures)).toBe(0)
  })
  it('EN_COURS ne compte pas comme réalisé', () => {
    expect(completionRatio('r1', mesures)).not.toBe(3 / 4)
  })
})

describe('risqueADate — interpolation brut→résiduel selon l\'avancement', () => {
  const r: RiskLike = { id: 'r1', gravite: 4, vraisemblance: 3, graviteResiduelle: 2, vraisemblanceResiduelle: 1 }

  it('avancement 0 → reste au brut', () => {
    expect(risqueADate(r, [{ risqueId: 'r1', statut: 'A_FAIRE' }])).toEqual({ gravite: 4, vraisemblance: 3 })
  })
  it('avancement 100% → atteint le résiduel cible', () => {
    expect(risqueADate(r, [{ risqueId: 'r1', statut: 'REALISE' }])).toEqual({ gravite: 2, vraisemblance: 1 })
  })
  it('avancement 50% → point médian arrondi', () => {
    // c=0.5 : g = round(4+0.5*(2-4))=3 ; v = round(3+0.5*(1-3))=2
    const m = [{ risqueId: 'r1', statut: 'REALISE' }, { risqueId: 'r1', statut: 'A_FAIRE' }]
    expect(risqueADate(r, m)).toEqual({ gravite: 3, vraisemblance: 2 })
  })
  it('sans mesure liée → reste au brut', () => {
    expect(risqueADate(r, [])).toEqual({ gravite: 4, vraisemblance: 3 })
  })
  it('sans cible résiduelle → reste au brut quel que soit l\'avancement', () => {
    const noRes: RiskLike = { id: 'r3', gravite: 3, vraisemblance: 3 }
    expect(risqueADate(noRes, [{ risqueId: 'r3', statut: 'REALISE' }])).toEqual({ gravite: 3, vraisemblance: 3 })
  })
  it('borne les coordonnées à [1..4]', () => {
    const extreme: RiskLike = { id: 'r4', gravite: 4, vraisemblance: 4, graviteResiduelle: 1, vraisemblanceResiduelle: 1 }
    const res = risqueADate(extreme, [{ risqueId: 'r4', statut: 'REALISE' }])
    expect(res.gravite).toBeGreaterThanOrEqual(1)
    expect(res.vraisemblance).toBeLessThanOrEqual(4)
  })
})
