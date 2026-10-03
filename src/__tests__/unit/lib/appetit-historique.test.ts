import { describe, expect, it } from 'vitest'
import { periodeCourante, resumeDepuisRasRad, tendances, type ResumeAppetence } from '@/lib/appetit-historique'

const data = {
  global: 'ORANGE' as const, modules: { registre: true, maturite: true, kri: true },
  appetit: { synthese: { evalues: 20, horsAppetit: 3, dansAppetit: 17 }, seuilGlobal: 8, voyant: 'ORANGE' as const },
  maturite: [{ code: 'ISO27001', belowTarget: 5, assessed: 40, total: 93, averageCurrent: 2.4, averageTarget: 3, voyant: 'ORANGE' as const }],
  kri: { total: 10, alerte: 2, critique: 1, enAlerte: [{ intitule: 'MFA' }], voyant: 'ROUGE' as const },
}

describe('instantanés d’appétence (RAS / RAD)', () => {
  it('période = mois UTC (AAAA-MM)', () => {
    expect(periodeCourante(new Date('2026-10-03T10:00:00Z'))).toBe('2026-10')
    expect(periodeCourante(new Date('2026-01-31T23:59:59Z'))).toBe('2026-01')
  })
  it('résumé compact : seulement des agrégats (aucun intitulé de risque ni de KRI)', () => {
    const r = resumeDepuisRasRad(data as never)
    expect(r).toEqual({ global: 'ORANGE', appetit: { evalues: 20, horsAppetit: 3, seuilGlobal: 8, voyant: 'ORANGE' }, maturite: [{ code: 'ISO27001', belowTarget: 5, assessed: 40, averageCurrent: 2.4, averageTarget: 3, voyant: 'ORANGE' }], kri: { total: 10, alerte: 2, critique: 1, voyant: 'ROUGE' } })
    expect(JSON.stringify(r)).not.toContain('MFA')
  })
  it('modules inactifs : sections omises', () => {
    const r = resumeDepuisRasRad({ ...data, modules: { registre: false, maturite: false, kri: true }, appetit: null, maturite: [] } as never)
    expect(r.appetit).toBeUndefined(); expect(r.maturite).toEqual([]); expect(r.kri).toBeDefined()
  })
  it('tendances entre périodes consécutives : amélioration / dégradation / stable, du plus ancien au plus récent', () => {
    const mk = (hors: number, alerte: number, critique: number, below: number): ResumeAppetence => ({ global: 'VERT', appetit: { evalues: 20, horsAppetit: hors, seuilGlobal: 8, voyant: 'VERT' }, maturite: [{ code: 'X', belowTarget: below, assessed: 10, averageCurrent: 2, averageTarget: 3, voyant: 'VERT' }], kri: { total: 10, alerte, critique, voyant: 'VERT' } })
    const t = tendances([{ periode: '2026-09', resume: mk(5, 3, 1, 8) }, { periode: '2026-08', resume: mk(4, 2, 1, 8) }, { periode: '2026-10', resume: mk(2, 2, 2, 8) }])
    expect(t.map(x => x.periode)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(t[0].delta).toBeNull()
    expect(t[1].delta).toMatchObject({ horsAppetit: 1, kriAlerte: 1, kriCritique: 0, maturiteSousCible: 0 })
    expect(t[1].sens).toBe('DEGRADATION')
    expect(t[2].delta).toMatchObject({ horsAppetit: -3, kriCritique: 1 })
    expect(t[2].sens).toBe('AMELIORATION')    // 3 risques hors appétit en moins pour 1 KRI critique en plus : solde négatif des indicateurs
    expect(tendances([{ periode: '2026-10', resume: mk(2, 2, 2, 8) }, { periode: '2026-11', resume: mk(2, 2, 2, 8) }])[1].sens).toBe('STABLE')
  })
})
