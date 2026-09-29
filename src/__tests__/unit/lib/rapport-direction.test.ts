/** R-GRC-3 : rapport « une page » direction (voyant, chiffres clés, décisions à prendre). */
import { describe, expect, it } from 'vitest'
import { buildRapportDirection } from '@/lib/rapport-direction'
import type { Bloc } from '@/lib/rapport-model'

const now = new Date('2026-10-02T12:00:00Z')
const periode = { debut: '2026-09-01', fin: '2026-09-30' }
const kpis = (r: ReturnType<typeof buildRapportDirection>, id: string) => Object.fromEntries((r.sections.find(s => s.id === id)!.blocs[0] as Extract<Bloc, { type: 'kpis' }>).items.map(k => [k.cle, k.valeur]))
const decisions = (r: ReturnType<typeof buildRapportDirection>) => (r.sections.find(s => s.id === 'decisions')!.blocs[0] as Extract<Bloc, { type: 'tableau' }>).lignes

const base = {
  consolide: { risques: { total: 40, eleve: 5, moyen: 20, faible: 10, nonCote: 5 }, actions: { total: 30, faits: 10, enRetard: 4, tauxAvancement: 33 }, controles: { tauxConformite: 91, anomalies: 2 } },
  modules: { risques: true, appetit: false, incidents: true, controles: true, audit: true, regulateur: false, kri: false, dora: false },
  incidents: { ouverts: 3, perteNettePeriode: 12000, notifsEnRetard: 2, grandesPertes: 1 },
  deviseReference: 'EUR', periode, now,
}

describe('buildRapportDirection', () => {
  it('une page : voyant, chiffres clés, décisions', () => {
    const r = buildRapportDirection(base)
    expect(r.code).toBe('R-GRC-3')
    expect(r.sections.map(s => s.id)).toEqual(['voyant', 'chiffres', 'decisions'])
  })
  it('voyant : MODÉRÉ avec des alertes non critiques, ÉLEVÉ dès un signal de crise', () => {
    expect(kpis(buildRapportDirection(base), 'voyant').niveau).toBe('MODERE')
    const crise = buildRapportDirection({ ...base, consolide: { ...base.consolide, audit: { critiques: 2, recosEnRetard: 0 } } })
    expect(kpis(crise, 'voyant').niveau).toBe('ELEVE')
    const ok = buildRapportDirection({ ...base, consolide: { ...base.consolide, actions: { total: 30, faits: 30, enRetard: 0, tauxAvancement: 100 } }, incidents: { ouverts: 0, perteNettePeriode: 0, notifsEnRetard: 0, grandesPertes: 0 } })
    expect(kpis(ok, 'voyant').niveau).toBe('MAITRISE')
  })
  it('cinq chiffres clés issus du consolidé et des incidents de la période', () => {
    expect(kpis(buildRapportDirection(base), 'chiffres')).toEqual({ risquesEleves: 5, actionsEnRetard: 4, incidentsOuverts: 3, perteNette: 12000, conformite: 91 })
  })
  it('décisions à prendre : au plus trois, les plus critiques d’abord, avec leur valeur', () => {
    const r = buildRapportDirection({ ...base, consolide: { ...base.consolide, audit: { critiques: 2, recosEnRetard: 0 } } })
    const d = decisions(r)
    expect(d).toHaveLength(3)
    expect(d[0]).toEqual([{ k: 'rapports.decisions.constatsCritiques' }, 2])
    expect(d.map(x => (x[0] as { k: string }).k)).toContain('rapports.decisions.notifsEnRetard')
  })
  it('sans module actif pour une donnée, le chiffre est omis (jamais inventé)', () => {
    const r = buildRapportDirection({ ...base, modules: { ...base.modules, incidents: false, controles: false }, consolide: { risques: base.consolide.risques, actions: base.consolide.actions }, incidents: undefined })
    expect(kpis(r, 'chiffres')).toEqual({ risquesEleves: 5, actionsEnRetard: 4 })
  })
})
