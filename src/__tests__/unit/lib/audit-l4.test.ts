/** Audit interne L4 : notation, jalons, indépendance, suivi des recommandations, univers et plan pluriannuel. */
import { describe, expect, it } from 'vitest'
import {
  cleanNotation, JALONS, cleanJalons, phaseCourante, cleanIndependance,
  appliquerSuivi, synthetiserRecommandations, cleanUniversInput, cycleAnsDefaut, planPluriannuel,
} from '@/lib/audit-l4'
import { constatTermine } from '@/lib/audit'
import { normalizeAuditConstat } from '@/lib/action-items'
import { synthetiserSuiviRegulateur } from '@/lib/suivi-regulateur'

const now = new Date('2026-09-29T10:00:00Z')

describe('notation de mission', () => {
  it('échelle 1-4 ; hors échelle ou vide → null', () => {
    expect([cleanNotation(1), cleanNotation('3'), cleanNotation(4)]).toEqual([1, 3, 4])
    expect([cleanNotation(0), cleanNotation(5), cleanNotation('x'), cleanNotation(null), cleanNotation(2.5)]).toEqual([null, null, null, null, null])
  })
})

describe('jalons du cycle de mission', () => {
  it('six jalons datés ; entrée nettoyée (dates invalides écartées)', () => {
    expect(JALONS).toEqual(['lettreMission', 'reunionOuverture', 'rapportProvisoire', 'reponseAudite', 'reunionCloture', 'rapportFinal'])
    expect(cleanJalons({ lettreMission: '2026-01-05', rapportFinal: 'nope', autre: '2026-01-01' })).toEqual({ lettreMission: '2026-01-05T00:00:00.000Z' })
    expect(cleanJalons(null)).toEqual({})
  })
  it('phase courante = dernier jalon atteint (dans l’ordre du cycle)', () => {
    expect(phaseCourante({})).toBeNull()
    expect(phaseCourante({ lettreMission: 'x', reunionOuverture: 'y' })).toBe('reunionOuverture')
    expect(phaseCourante({ rapportProvisoire: 'x', lettreMission: 'y' })).toBe('rapportProvisoire')
  })
})

describe('indépendance (conflit d’intérêts)', () => {
  it('déclaration tracée ; un conflit exige un commentaire', () => {
    expect(cleanIndependance({ conflit: false }, { auteur: 'u1', now })).toEqual({ conflit: false, declarePar: 'u1', declareLe: now.toISOString() })
    expect(cleanIndependance({ conflit: true, commentaire: 'Ancien responsable du processus' }, { auteur: 'u1', now }))
      .toEqual({ conflit: true, commentaire: 'Ancien responsable du processus', declarePar: 'u1', declareLe: now.toISOString() })
    expect(cleanIndependance({ conflit: true }, { auteur: 'u1', now })).toBeNull()
    expect(cleanIndependance('x', { auteur: 'u1', now })).toBeNull()
  })
})

describe('suivi des recommandations (appliquerSuivi)', () => {
  const base = { statut: 'EN_COURS', echeance: new Date('2026-10-31T00:00:00Z'), echeanceInitiale: null as Date | null, reports: [] as unknown[], realiseePar: null as string | null }
  const audite = { acteur: 'u2', auditeur: false, now }
  const auditeur = { acteur: 'u9', auditeur: true, now }
  it('l’audité déclare la recommandation réalisée ; l’audit la vérifie (jamais la même personne)', () => {
    const r = appliquerSuivi({ ...base }, { action: 'DECLARER_REALISE' }, audite)
    expect(r).toMatchObject({ ok: true, patch: { statut: 'RESOLU', realiseePar: 'u2' } })
    const v = appliquerSuivi({ ...base, statut: 'RESOLU', realiseePar: 'u2' }, { action: 'VERIFIER', commentaire: 'Preuves contrôlées' }, auditeur)
    expect(v).toMatchObject({ ok: true, patch: { statut: 'VERIFIE', verifiePar: 'u9', verificationCommentaire: 'Preuves contrôlées' } })
    expect(appliquerSuivi({ ...base, statut: 'RESOLU', realiseePar: 'u9' }, { action: 'VERIFIER' }, auditeur)).toEqual({ ok: false, error: 'verification_meme_personne' })
    expect(appliquerSuivi({ ...base, statut: 'RESOLU', realiseePar: 'u2' }, { action: 'VERIFIER' }, audite)).toEqual({ ok: false, error: 'role_audit_requis' })
    expect(appliquerSuivi({ ...base, statut: 'OUVERT' }, { action: 'VERIFIER' }, auditeur)).toEqual({ ok: false, error: 'transition_interdite' })
  })
  it('réouverture par l’audit avec motif obligatoire', () => {
    expect(appliquerSuivi({ ...base, statut: 'VERIFIE' }, { action: 'REOUVRIR' }, auditeur)).toEqual({ ok: false, error: 'commentaire_requis' })
    expect(appliquerSuivi({ ...base, statut: 'VERIFIE' }, { action: 'REOUVRIR', commentaire: 'Preuve insuffisante' }, auditeur)).toMatchObject({ ok: true, patch: { statut: 'EN_COURS', verifiePar: null } })
  })
  it('report d’échéance : demande par l’audité, décision par l’audit, échéance initiale conservée', () => {
    const d = appliquerSuivi({ ...base }, { action: 'DEMANDER_REPORT', nouvelleEcheance: '2026-12-31', motif: 'Dépendance projet' }, audite)
    expect(d.ok).toBe(true)
    const reports = (d as unknown as { patch: { reports: { statut: string; ancienne: string; nouvelle: string }[] } }).patch.reports
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({ statut: 'DEMANDE', ancienne: '2026-10-31T00:00:00.000Z', nouvelle: '2026-12-31T00:00:00.000Z' })
    // une seule demande en attente à la fois
    expect(appliquerSuivi({ ...base, reports }, { action: 'DEMANDER_REPORT', nouvelleEcheance: '2027-01-31', motif: 'x' }, audite)).toEqual({ ok: false, error: 'report_en_attente' })
    const ok = appliquerSuivi({ ...base, reports }, { action: 'DECIDER_REPORT', index: 0, decision: 'APPROUVE' }, auditeur)
    expect(ok).toMatchObject({ ok: true, patch: { echeance: new Date('2026-12-31T00:00:00.000Z'), echeanceInitiale: new Date('2026-10-31T00:00:00.000Z') } })
    expect((ok as unknown as { patch: { reports: { statut: string }[] } }).patch.reports[0].statut).toBe('APPROUVE')
    const ko = appliquerSuivi({ ...base, reports }, { action: 'DECIDER_REPORT', index: 0, decision: 'REFUSE' }, auditeur)
    expect((ko as unknown as { patch: Record<string, unknown> }).patch.echeance).toBeUndefined()
    expect(appliquerSuivi({ ...base, reports }, { action: 'DECIDER_REPORT', index: 0, decision: 'APPROUVE' }, audite)).toEqual({ ok: false, error: 'role_audit_requis' })
  })
  it('report : nouvelle échéance postérieure à l’actuelle, motif requis, constat non terminé', () => {
    expect(appliquerSuivi({ ...base }, { action: 'DEMANDER_REPORT', nouvelleEcheance: '2026-10-01', motif: 'x' }, audite)).toEqual({ ok: false, error: 'echeance_invalide' })
    expect(appliquerSuivi({ ...base }, { action: 'DEMANDER_REPORT', nouvelleEcheance: '2026-12-31', motif: ' ' }, audite)).toEqual({ ok: false, error: 'commentaire_requis' })
    expect(appliquerSuivi({ ...base, statut: 'VERIFIE' }, { action: 'DEMANDER_REPORT', nouvelleEcheance: '2026-12-31', motif: 'x' }, audite)).toEqual({ ok: false, error: 'transition_interdite' })
  })
  it('VERIFIE est un état terminal', () => {
    expect(constatTermine('VERIFIE' as never)).toBe(true)
  })
})

describe('synthetiserRecommandations', () => {
  const c = (o: object) => ({ statut: 'OUVERT', criticite: 2, echeance: null as Date | null, createdAt: new Date('2026-06-01T00:00:00Z'), reports: [] as { statut: string }[], source: 'AUDIT_INTERNE', ...o })
  const s = synthetiserRecommandations([
    c({ statut: 'OUVERT', criticite: 4, echeance: new Date('2026-08-01T00:00:00Z') }),
    c({ statut: 'EN_COURS', createdAt: new Date('2026-01-01T00:00:00Z'), reports: [{ statut: 'APPROUVE' }, { statut: 'DEMANDE' }] }),
    c({ statut: 'RESOLU' }), c({ statut: 'VERIFIE', source: 'REGULATEUR' }), c({ statut: 'VERIFIE' }), c({ statut: 'ACCEPTE' }),
  ], now)
  it('volumes, retards, reports, taux de mise en œuvre et de vérification', () => {
    expect(s).toMatchObject({ total: 6, ouvertes: 2, realisees: 1, verifiees: 2, acceptees: 1, enRetard: 1, reportees: 1, reportsEnAttente: 1 })
    expect(s.tauxMiseEnOeuvre).toBe(60) // (1+2)/(6-1)
    expect(s.tauxVerification).toBe(67) // 2/(1+2)
  })
  it('ancienneté des recommandations ouvertes', () => {
    expect(s.plusAncienneJours).toBe(271) // 2026-01-01 → 2026-09-29
    expect(s.ancienneteMoyenneJours).toBe(Math.round((120 + 271) / 2)) // 1er juin → 29 sept = 120 j
  })
  it('ventilation par criticité et par source', () => {
    expect(s.parSource).toEqual({ AUDIT_INTERNE: 5, REGULATEUR: 1 })
    expect(s.parCriticite[4]).toBe(1)
  })
})

describe('univers d’audit et plan pluriannuel', () => {
  it('entrée nettoyée : type connu, risque 1-4, cycle borné', () => {
    expect(cleanUniversInput({ intitule: '  Paiements ', type: 'PROCESSUS', risque: 4, cycleAns: 2, processusId: 'p1' }))
      .toEqual({ intitule: 'Paiements', type: 'PROCESSUS', risque: 4, cycleAns: 2, processusId: 'p1', commentaire: null, actif: true })
    expect(cleanUniversInput({ intitule: 'X', type: 'nope', risque: 9, cycleAns: 99 })).toMatchObject({ type: 'AUTRE', risque: 2, cycleAns: null })
  })
  it('cycle par défaut selon le risque : 4→1 an, 3→2, 2→3, 1→5 (surchargeable)', () => {
    expect([4, 3, 2, 1].map(r => cycleAnsDefaut(r))).toEqual([1, 2, 3, 5])
    expect(cycleAnsDefaut(4, { 4: 2 })).toBe(2)
  })
  const univers = [
    { id: 'u1', intitule: 'Paiements', type: 'PROCESSUS', risque: 4, cycleAns: null, actif: true, processusId: 'p1' },
    { id: 'u2', intitule: 'RH', type: 'PROCESSUS', risque: 2, cycleAns: null, actif: true, processusId: 'p2' },
    { id: 'u3', intitule: 'Filiale Nord', type: 'ENTITE', risque: 3, cycleAns: 1, actif: true, processusId: null },
    { id: 'u4', intitule: 'Jamais audité', type: 'AUTRE', risque: 3, cycleAns: null, actif: true, processusId: null },
    { id: 'u5', intitule: 'Inactif', type: 'AUTRE', risque: 4, cycleAns: null, actif: false, processusId: null },
  ]
  const missions = [
    { id: 'm1', statut: 'CLOTUREE', dateDebut: new Date('2025-02-01T00:00:00Z'), dateFin: new Date('2025-03-01T00:00:00Z'), processusIds: ['p1'], universIds: [] as string[] },
    { id: 'm2', statut: 'CLOTUREE', dateDebut: new Date('2025-10-01T00:00:00Z'), dateFin: new Date('2025-11-15T00:00:00Z'), processusIds: ['p2'], universIds: [] as string[] },
    { id: 'm3', statut: 'CLOTUREE', dateDebut: new Date('2026-01-10T00:00:00Z'), dateFin: new Date('2026-02-10T00:00:00Z'), processusIds: [], universIds: ['u3'] },
    { id: 'm4', statut: 'PLANIFIEE', dateDebut: new Date('2026-11-01T00:00:00Z'), dateFin: null, processusIds: ['p1'], universIds: [] as string[] },
  ]
  const p = planPluriannuel(univers, missions, now, { horizonAns: 3 })
  const e = (id: string) => p.entrees.find(x => x.universId === id)!
  it('statut de couverture par entrée : en retard, planifié, à jour, jamais audité ; inactifs exclus', () => {
    expect(p.entrees.map(x => x.universId)).toEqual(['u1', 'u2', 'u3', 'u4'])
    expect(e('u1')).toMatchObject({ derniere: '2025-03-01', cycleAns: 1, prochaine: '2026-03-01', statut: 'EN_RETARD', planifiee: '2026-11-01' })
    expect(e('u2')).toMatchObject({ derniere: '2025-11-15', cycleAns: 3, prochaine: '2028-11-15', statut: 'A_JOUR' })
    expect(e('u3')).toMatchObject({ derniere: '2026-02-10', cycleAns: 1, prochaine: '2027-02-10', statut: 'A_PLANIFIER' })
    expect(e('u4')).toMatchObject({ derniere: null, statut: 'JAMAIS_AUDITE' })
  })
  it('synthèse : couverture = entrées dans leur cycle', () => {
    expect(p.synthese).toMatchObject({ total: 4, aJour: 1, aPlanifier: 1, planifie: 0, enRetard: 1, jamais: 1, couverturePct: 50 })
  })
  it('plan par année : les retards et jamais audités sont dus dès l’année en cours', () => {
    expect(p.parAnnee.map(a => a.annee)).toEqual([2026, 2027, 2028])
    expect(p.parAnnee[0].universIds.sort()).toEqual(['u1', 'u4'])
    expect(p.parAnnee[1].universIds).toEqual(['u3'])
    expect(p.parAnnee[2].universIds).toEqual(['u2'])
  })
})

describe('régression : « Vérifiée » est terminal partout où RESOLU / ACCEPTE l’étaient', () => {
  it('plan d’action unifié : une recommandation vérifiée est FAIT', () => {
    expect(normalizeAuditConstat({ id: 'c', intitule: 'x', statut: 'VERIFIE' }).statut).toBe('FAIT')
    expect(normalizeAuditConstat({ id: 'c', intitule: 'x', statut: 'RESOLU' }).statut).toBe('FAIT')
    expect(normalizeAuditConstat({ id: 'c', intitule: 'x', statut: 'EN_COURS' }).statut).toBe('EN_COURS')
  })
  it('suivi régulateur : un constat vérifié n’est ni ouvert ni en retard', () => {
    const c = (statut: string) => ({ id: statut, intitule: statut, description: null, recommandation: null, criticite: 4, source: 'REGULATEUR', statut, echeance: new Date('2026-01-01T00:00:00Z'), responsableAction: null, missionIntitule: null })
    const s = synthetiserSuiviRegulateur([c('VERIFIE'), c('OUVERT')], now)
    expect(s.total).toBe(2)
    expect(s.ouverts).toBe(1)
    expect(s.echues).toBe(1)
  })
})
