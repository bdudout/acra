/** Rapports R-AUD-1 (plan et couverture), R-AUD-2 (missions et constats), R-AUD-3 (suivi des recommandations). */
import { describe, expect, it } from 'vitest'
import { buildRapportPlanAudit, buildRapportMissions, buildRapportRecommandations, type AuditRapportData } from '@/lib/rapport-audit'
import type { Bloc } from '@/lib/rapport-model'

const now = new Date('2026-09-29T10:00:00Z')
const periode = { debut: '2026-01-01', fin: '2026-12-31' }
const d = (s: string) => new Date(`${s}T00:00:00Z`)
const data: AuditRapportData = {
  univers: [
    { id: 'u1', intitule: 'Paiements', type: 'PROCESSUS', risque: 4, cycleAns: null, actif: true, processusId: 'p1' },
    { id: 'u2', intitule: 'RH', type: 'PROCESSUS', risque: 2, cycleAns: null, actif: true, processusId: 'p2' },
    { id: 'u3', intitule: 'Jamais audité', type: 'AUTRE', risque: 3, cycleAns: null, actif: true, processusId: null },
  ],
  missions: [
    { id: 'm1', intitule: 'Audit paiements', statut: 'CLOTUREE', dateDebut: d('2026-02-01'), dateFin: d('2026-03-01'), notation: 3, independance: { conflit: false, declarePar: 'u1', declareLe: '2026-02-01T00:00:00.000Z' }, processusIds: ['p1'], universIds: [] },
    { id: 'm2', intitule: 'Audit RH', statut: 'CLOTUREE', dateDebut: d('2025-10-01'), dateFin: d('2025-11-15'), notation: null, independance: {}, processusIds: ['p2'], universIds: [] },
    { id: 'm3', intitule: 'Audit conformité', statut: 'EN_COURS', dateDebut: d('2026-09-01'), dateFin: null, notation: null, independance: {}, processusIds: [], universIds: [] },
  ],
  constats: [
    { id: 'c1', missionId: 'm1', intitule: 'Revue des accès absente', criticite: 4, statut: 'OUVERT', echeance: d('2026-08-01'), echeanceInitiale: null, createdAt: d('2026-03-05'), reports: [], source: 'AUDIT_INTERNE' },
    { id: 'c2', missionId: 'm1', intitule: 'Procédure obsolète', criticite: 2, statut: 'VERIFIE', echeance: null, echeanceInitiale: null, createdAt: d('2026-03-05'), reports: [], source: 'AUDIT_INTERNE' },
    { id: 'c3', missionId: 'm1', intitule: 'Écart régulateur', criticite: 3, statut: 'RESOLU', echeance: null, echeanceInitiale: null, createdAt: d('2025-12-01'), reports: [{ statut: 'DEMANDE', nouvelle: 'x', motif: 'y', demandePar: 'u', demandeLe: 'z' }], source: 'REGULATEUR' },
  ],
}
const kpis = (r: { sections: { id: string; blocs: Bloc[] }[] }, id: string) => Object.fromEntries((r.sections.find(s => s.id === id)!.blocs[0] as Extract<Bloc, { type: 'kpis' }>).items.map(k => [k.cle, k.valeur]))
const tableau = (r: { sections: { id: string; blocs: Bloc[] }[] }, id: string) => r.sections.find(s => s.id === id)!.blocs.find(b => b.type === 'tableau') as Extract<Bloc, { type: 'tableau' }>

describe('R-AUD-1 — plan d’audit et couverture', () => {
  const r = buildRapportPlanAudit(data, periode, now)
  it('synthèse : couverture de l’univers, retards, jamais audité, missions de la période', () => {
    const k = kpis(r, 'synthese')
    expect(k.univers).toBe(3)
    expect(k.enRetard).toBe(0)     // RH : 2025-11 + 3 ans → à jour ; Paiements : 2026-03 + 1 an → à planifier ; « Jamais audité » : jamais
    expect(k.jamais).toBe(1)
    expect(k.couverture).toBe(67)
    expect(k.missionsPeriode).toBe(2)
  })
  it('univers non couverts listés, plan par année et missions', () => {
    expect(tableau(r, 'universAttention').lignes.map(l => l[0])).toContain('Jamais audité')
    expect(tableau(r, 'parAnnee').lignes).toHaveLength(3)
    expect(tableau(r, 'missions').lignes.map(l => l[0])).toEqual(expect.arrayContaining(['Audit paiements', 'Audit conformité']))
  })
})

describe('R-AUD-2 — missions et constats de la période', () => {
  const r = buildRapportMissions(data, periode, now)
  it('synthèse : missions clôturées, notation moyenne, constats, critiques, indépendance non déclarée', () => {
    const k = kpis(r, 'synthese')
    expect(k.missionsCloturees).toBe(1)
    expect(k.notationMoyenne).toBe(3)
    expect(k.constats).toBe(2) // c1, c2 créés en 2026 (c3 en 2025)
    expect(k.critiques).toBe(1)
    expect(k.independanceNonDeclaree).toBe(1) // m3 (m2 hors période)
  })
  it('tableau des missions avec notation traduite et constats par mission', () => {
    const t = tableau(r, 'missions')
    const m1 = t.lignes.find(l => l[0] === 'Audit paiements')!
    expect(m1[2]).toEqual({ k: 'rapports.notations.3' })
    expect(m1[3]).toBe(3) // tous les constats de la mission
  })
})

describe('R-AUD-3 — suivi des recommandations', () => {
  const r = buildRapportRecommandations(data, periode, now)
  it('mise en œuvre, vérification, retards, reports en attente, ancienneté', () => {
    const k = kpis(r, 'synthese')
    expect(k.total).toBe(3)
    expect(k.enRetard).toBe(1)
    expect(k.reportsEnAttente).toBe(1)
    expect(k.tauxMiseEnOeuvre).toBe(67)  // (1 réalisée + 1 vérifiée) / 3
    expect(k.tauxVerification).toBe(50)  // 1 / (1 + 1)
  })
  it('recommandations ouvertes les plus anciennes avec ancienneté et statut', () => {
    const t = tableau(r, 'plusAnciennes')
    expect(t.lignes).toHaveLength(1)
    expect(t.lignes[0][0]).toBe('Revue des accès absente')
    expect(t.lignes[0][3]).toBe(208) // 2026-03-05 → 2026-09-29
  })
})
