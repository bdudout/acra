/** Rapports R-CTL-1 (avancement du plan), R-CTL-2 (efficacité du dispositif), R-CTL-3 (anomalies récurrentes). */
import { describe, expect, it } from 'vitest'
import { buildRapportPlanControle, buildRapportEfficacite, buildRapportAnomalies, type ControleRapportRow } from '@/lib/rapport-controles'
import type { Bloc } from '@/lib/rapport-model'

const now = new Date('2026-05-15T00:00:00Z')
const periode = { debut: '2026-01-01', fin: '2026-06-30' }
const d = (s: string) => new Date(`${s}T00:00:00Z`)
const ex = (date: string, resultat: string) => ({ resultat, dateRealisation: d(date) })
const base = { niveau: 'N1', responsable: 'Alice', actif: true, cle: false, modeControle: 'MANUEL', typeControle: 'DETECTIF', periodicite: 'MENSUEL', creeLe: d('2025-01-01'), conception: null }
const rows: ControleRapportRow[] = [
  { ...base, id: 'c1', intitule: 'Revue des accès', cle: true, conception: { statut: 'ADEQUATE' }, executions: [ex('2026-01-10', 'CONFORME'), ex('2026-02-12', 'CONFORME'), ex('2026-04-03', 'CONFORME')] },
  { ...base, id: 'c2', intitule: 'Sauvegardes', periodicite: 'TRIMESTRIEL', niveau: 'N2', cle: true, conception: { statut: 'INADEQUATE' }, executions: [ex('2026-02-01', 'ANOMALIE'), ex('2026-03-01', 'ANOMALIE'), ex('2026-04-05', 'ANOMALIE')] },
  { ...base, id: 'c3', intitule: 'Patchs', modeControle: 'AUTOMATIQUE', periodicite: 'MENSUEL', responsable: 'Bob', executions: [ex('2026-01-05', 'CONFORME')] },
  { ...base, id: 'c4', intitule: 'Inactif', actif: false, executions: [] },
]
const kpis = (r: { sections: { id: string; blocs: Bloc[] }[] }, id: string) => Object.fromEntries((r.sections.find(s => s.id === id)!.blocs[0] as Extract<Bloc, { type: 'kpis' }>).items.map(k => [k.cle, k.valeur]))
const tableau = (r: { sections: { id: string; blocs: Bloc[] }[] }, id: string) => r.sections.find(s => s.id === id)!.blocs.find(b => b.type === 'tableau') as Extract<Bloc, { type: 'tableau' }>

describe('R-CTL-1 — avancement du plan de contrôle', () => {
  const r = buildRapportPlanControle(rows, periode, now)
  it('synthèse : occurrences prévues, échues, réalisées, en retard, taux, flux interrompus', () => {
    const k = kpis(r, 'synthese')
    expect(k.prevues).toBe(12 + 4 + 12) // c1 + c2 + c3 (c4 inactif exclu)
    expect(k.enRetard).toBeGreaterThan(0)
    expect(typeof k.tauxRealisation).toBe('number')
    expect(k.fluxInterrompus).toBe(1) // c3 automatique sans résultat depuis janvier
  })
  it('répartition par mois d’échéance et par niveau', () => {
    expect(tableau(r, 'parMois').lignes).toHaveLength(12)
    expect(tableau(r, 'parNiveau').lignes.map(l => l[0])).toEqual(['N1', 'N2'])
  })
  it('contrôles en retard listés avec responsable et nombre de périodes en retard', () => {
    const t = tableau(r, 'controlesEnRetard')
    expect(t.lignes[0]).toEqual(expect.arrayContaining(['Patchs', 'Bob']))
  })
})

describe('R-CTL-2 — efficacité du dispositif (conception vs efficacité opérationnelle)', () => {
  const r = buildRapportEfficacite(rows, periode, now)
  it('synthèse : contrôles actifs, clés, conception évaluée, répartition des appréciations', () => {
    const k = kpis(r, 'synthese')
    expect(k.actifs).toBe(3)
    expect(k.cles).toBe(2)
    expect(k.conceptionEvaluee).toBe(2)
    expect(k.defaillants).toBe(1) // Sauvegardes : conception inadéquate
    expect(k.efficaces).toBe(1)   // Revue des accès : conception adéquate + 100 % conforme
  })
  it('les contrôles clés sont détaillés avec conception, taux de conformité et appréciation', () => {
    const t = tableau(r, 'controlesCles')
    expect(t.lignes).toHaveLength(2)
    const acces = t.lignes.find(l => l[0] === 'Revue des accès')!
    expect(acces[1]).toEqual({ k: 'rapports.conception.ADEQUATE' })
    expect(acces[3]).toEqual({ k: 'rapports.appreciations.EFFICACE' })
  })
})

describe('R-CTL-3 — anomalies récurrentes et escalade', () => {
  const r = buildRapportAnomalies(rows, periode, now)
  it('synthèse : anomalies de la période, contrôles concernés, récurrentes, escalades comité', () => {
    const k = kpis(r, 'synthese')
    expect(k.anomalies).toBe(3)
    expect(k.controlesEnAnomalie).toBe(1)
    expect(k.recurrentes).toBe(1)
    expect(k.escaladesComite).toBe(1) // Sauvegardes est un contrôle clé récurrent
  })
  it('table des récurrences avec nombre de consécutives et escalade', () => {
    const t = tableau(r, 'recurrentes')
    expect(t.lignes).toEqual([['Sauvegardes', 'Alice', 3, { k: 'rapports.escalades.COMITE' }]])
  })
})
