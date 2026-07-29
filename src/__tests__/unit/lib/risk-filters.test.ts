import { describe, it, expect } from 'vitest'
import {
  matchesFilters, applyFilters, riskNiveauBucket, activeFilterCount,
  parseFilters, filtersToQuery, distinctEntites, type FilterableRisk,
} from '@/lib/risk-filters'

function mk(p: Partial<FilterableRisk>): FilterableRisk {
  return {
    taxonomieCode: p.taxonomieCode ?? null, processusId: p.processusId ?? null,
    entite: p.entite ?? null, statut: p.statut ?? 'IDENTIFIE',
    niveauInherent: p.niveauInherent ?? null, niveauResiduel: p.niveauResiduel ?? null,
  }
}

describe('riskNiveauBucket', () => {
  it('résiduel prioritaire, repli inhérent, sinon nonCote', () => {
    expect(riskNiveauBucket(mk({ niveauInherent: 20, niveauResiduel: 4 }))).toBe('faible')
    expect(riskNiveauBucket(mk({ niveauInherent: 20, niveauResiduel: null }))).toBe('eleve')
    expect(riskNiveauBucket(mk({}))).toBe('nonCote')
  })
  it('mode inherent ignore le résiduel', () => {
    expect(riskNiveauBucket(mk({ niveauInherent: 20, niveauResiduel: 2 }), 'inherent')).toBe('eleve')
    expect(riskNiveauBucket(mk({ niveauInherent: null, niveauResiduel: 2 }), 'inherent')).toBe('nonCote')
  })
})

describe('matchesFilters', () => {
  const r = mk({ taxonomieCode: 'BALE_2', processusId: 'p1', entite: 'DAF', statut: 'EVALUE', niveauInherent: 20, niveauResiduel: 16 })
  it('aucun filtre → tout passe', () => {
    expect(matchesFilters(r, {})).toBe(true)
  })
  it('critères combinés en ET', () => {
    expect(matchesFilters(r, { taxonomieCode: 'BALE_2', entite: 'DAF' })).toBe(true)
    expect(matchesFilters(r, { taxonomieCode: 'BALE_2', entite: 'DSI' })).toBe(false)
    expect(matchesFilters(r, { processusId: 'p1', statut: 'EVALUE' })).toBe(true)
    expect(matchesFilters(r, { statut: 'CLOTURE' })).toBe(false)
  })
  it('filtre par palier de niveau selon le mode', () => {
    expect(matchesFilters(r, { niveau: 'eleve' })).toBe(true)              // résiduel 16
    expect(matchesFilters(r, { niveau: 'faible' })).toBe(false)
    expect(matchesFilters(mk({ niveauInherent: 2 }), { niveau: 'faible' })).toBe(true)
    expect(matchesFilters(mk({}), { niveau: 'nonCote' })).toBe(true)
  })
  it('valeurs nulles du risque ne matchent pas un critère renseigné', () => {
    expect(matchesFilters(mk({ taxonomieCode: null }), { taxonomieCode: 'BALE_1' })).toBe(false)
  })
})

describe('applyFilters', () => {
  it('filtre la liste', () => {
    const risks = [
      mk({ taxonomieCode: 'BALE_1', niveauResiduel: 20 }),
      mk({ taxonomieCode: 'BALE_2', niveauResiduel: 2 }),
      mk({ taxonomieCode: 'BALE_1', niveauResiduel: 2 }),
    ]
    expect(applyFilters(risks, { taxonomieCode: 'BALE_1' })).toHaveLength(2)
    expect(applyFilters(risks, { taxonomieCode: 'BALE_1', niveau: 'eleve' })).toHaveLength(1)
    expect(applyFilters(risks, {})).toHaveLength(3)
  })
})

describe('activeFilterCount', () => {
  it('compte les critères renseignés', () => {
    expect(activeFilterCount({})).toBe(0)
    expect(activeFilterCount({ mode: 'inherent' })).toBe(0) // le mode n'est pas un filtre
    expect(activeFilterCount({ taxonomieCode: 'BALE_1', niveau: 'eleve' })).toBe(2)
  })
})

describe('parseFilters / filtersToQuery', () => {
  const params = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null })
  it('parse en ignorant les valeurs vides', () => {
    const f = parseFilters(params({ taxonomieCode: 'BALE_2', entite: '  ', niveau: 'eleve' }))
    expect(f.taxonomieCode).toBe('BALE_2')
    expect(f.entite).toBeNull()
    expect(f.niveau).toBe('eleve')
    expect(f.mode).toBe('residual')
  })
  it('mode inherent reconnu', () => {
    expect(parseFilters(params({ mode: 'inherent' })).mode).toBe('inherent')
  })
  it('aller-retour query string', () => {
    const q = filtersToQuery({ taxonomieCode: 'BALE_2', niveau: 'eleve', mode: 'inherent' })
    expect(q).toContain('taxonomieCode=BALE_2')
    expect(q).toContain('niveau=eleve')
    expect(q).toContain('mode=inherent')
    const back = parseFilters(new URLSearchParams(q))
    expect(back.taxonomieCode).toBe('BALE_2')
    expect(back.niveau).toBe('eleve')
    expect(back.mode).toBe('inherent')
  })
  it('filtres vides → query vide', () => {
    expect(filtersToQuery({})).toBe('')
  })
})

describe('distinctEntites', () => {
  it('valeurs uniques triées, sans vides', () => {
    expect(distinctEntites([mk({ entite: 'DSI' }), mk({ entite: 'DAF' }), mk({ entite: 'DSI' }), mk({ entite: null }), mk({ entite: '  ' })]))
      .toEqual(['DAF', 'DSI'])
  })
})
