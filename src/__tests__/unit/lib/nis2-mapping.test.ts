import { describe, it, expect } from 'vitest'
import { NIS2_ART21_MEASURES, nis2CoverageForFramework, nis2CoveredCount } from '@/lib/nis2-mapping'

// Mapping EBIOS RM ↔ NIS2 Art. 21 (improvements-priority.md 🟠, différenciateur OSE/EEI).

describe('NIS2 Art. 21 — couverture par référentiel', () => {
  it('expose exactement les 10 mesures a→j', () => {
    expect(NIS2_ART21_MEASURES).toHaveLength(10)
    expect(NIS2_ART21_MEASURES.map(m => m.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'])
  })

  it('renvoie 10 entrées structurées pour un référentiel', () => {
    // NB : on évite ISO27001 ici car getFrameworkControles l'importe via require()
    // (alias @ non résolu sous vitest) ; DORA est un tableau statique.
    const cov = nis2CoverageForFramework('DORA')
    expect(cov).toHaveLength(10)
    for (const m of cov) {
      expect(typeof m.covered).toBe('boolean')
      expect(Array.isArray(m.controls)).toBe(true)
      if (m.covered) expect(m.controls.length).toBeGreaterThan(0)
    }
  })

  it('DORA couvre la gestion des incidents (b) et la continuité (c)', () => {
    const cov = nis2CoverageForFramework('DORA')
    const by = Object.fromEntries(cov.map(m => [m.id, m.covered]))
    expect(by.b).toBe(true)
    expect(by.c).toBe(true)
  })

  it('DORA couvre le risque prestataires / chaîne d’approvisionnement (d)', () => {
    expect(nis2CoverageForFramework('DORA').find(m => m.id === 'd')?.covered).toBe(true)
  })

  it('un référentiel riche (DORA) couvre une majorité des mesures', () => {
    expect(nis2CoveredCount('DORA')).toBeGreaterThanOrEqual(5)
  })

  it('CUSTOM sans contrôle → aucune mesure couverte', () => {
    expect(nis2CoveredCount('CUSTOM')).toBe(0)
    expect(nis2CoverageForFramework('CUSTOM').every(m => !m.covered)).toBe(true)
  })
})
