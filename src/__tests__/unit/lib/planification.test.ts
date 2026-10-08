// Programme pluriannuel d'audit et de contrôle (lot P1) : configuration, saisies, cycle de validation des plans annuels.
// Spec : docs/specs/programme-audit-controle.md.
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PLANIFICATION, sanitizePlanificationConfig, cleanPlanInput, cleanLigneInput,
  peutPreparer, peutValider, peutModifierLignes, transitionPlanAnnee, figerLignes,
} from '@/lib/planification'

describe('configuration « Planification »', () => {
  it('défauts : plan figé, double regard désactivé, angles morts à 3 ans, validateurs proposés', () => {
    expect(DEFAULT_PLANIFICATION.modeDefaut).toBe('FIGE')
    expect(DEFAULT_PLANIFICATION.doubleRegard).toBe(false)
    expect(DEFAULT_PLANIFICATION.seuilAnglesMortsAns).toBe(3)
    expect(DEFAULT_PLANIFICATION.AUDIT).toEqual({ preparateurs: ['AUDITEUR'], validateurs: ['DIRECTION_METIER', 'ADMIN'] })
    expect(DEFAULT_PLANIFICATION.CONTROLE).toEqual({ preparateurs: ['CONTROLEUR', 'CONFORMITE'], validateurs: ['RISK_MANAGER', 'RSSI'] })
  })
  it('assainie : rôles inconnus écartés, valeurs hors bornes ramenées au défaut, liste vide ⇒ défaut', () => {
    const c = sanitizePlanificationConfig({ modeDefaut: 'DYNAMIQUE', doubleRegard: true, seuilAnglesMortsAns: 99, AUDIT: { preparateurs: ['AUDITEUR', 'PIRATE'], validateurs: [] } })
    expect(c.modeDefaut).toBe('DYNAMIQUE'); expect(c.doubleRegard).toBe(true); expect(c.seuilAnglesMortsAns).toBe(3)
    expect(c.AUDIT).toEqual({ preparateurs: ['AUDITEUR'], validateurs: ['DIRECTION_METIER', 'ADMIN'] })
    expect(sanitizePlanificationConfig(null)).toEqual(DEFAULT_PLANIFICATION)
  })
})

describe('saisies', () => {
  it('plan : nom requis, type et prisme connus, horizon pluriannuel borné (1 à 10 ans)', () => {
    expect(cleanPlanInput({ nom: ' ', type: 'AUDIT' }, 'FIGE')).toEqual({ ok: false, error: 'nom_requis' })
    expect(cleanPlanInput({ nom: 'Audit SI', type: 'X' }, 'FIGE')).toEqual({ ok: false, error: 'type_invalide' })
    expect(cleanPlanInput({ nom: 'Audit SI', type: 'AUDIT', anneeDebut: 2027, anneeFin: 2026 }, 'FIGE')).toEqual({ ok: false, error: 'horizon_invalide' })
    expect(cleanPlanInput({ nom: 'Audit SI', type: 'AUDIT', anneeDebut: 2027, anneeFin: 2040 }, 'FIGE')).toEqual({ ok: false, error: 'horizon_invalide' })
    const ok = cleanPlanInput({ nom: 'Audit SI', type: 'AUDIT', equipe: 'Audit SI', prismePrincipal: 'REFERENTIEL', anneeDebut: 2027, anneeFin: 2029 }, 'FIGE')
    expect(ok).toEqual({ ok: true, plan: { nom: 'Audit SI', type: 'AUDIT', equipe: 'Audit SI', prismePrincipal: 'REFERENTIEL', mode: 'FIGE', anneeDebut: 2027, anneeFin: 2029, description: null } })
    // Mode : celui demandé s'il est valide, sinon le défaut de l'organisation.
    expect(cleanPlanInput({ nom: 'P', type: 'CONTROLE', mode: 'DYNAMIQUE', anneeDebut: 2027, anneeFin: 2027 }, 'FIGE')).toMatchObject({ ok: true, plan: { mode: 'DYNAMIQUE', prismePrincipal: 'PROCESSUS' } })
  })
  it('ligne : intitulé requis, cibles multiples dédoublonnées, échantillonnage tracé, dates dans l’année', () => {
    expect(cleanLigneInput({ intitule: '' }, 2027, 'RISQUE')).toEqual({ ok: false, error: 'intitule_requis' })
    expect(cleanLigneInput({ intitule: 'A', debut: '2028-01-10' }, 2027, 'RISQUE')).toEqual({ ok: false, error: 'dates_hors_annee' })
    expect(cleanLigneInput({ intitule: 'A', debut: '2027-06-10', fin: '2027-03-01' }, 2027, 'RISQUE')).toEqual({ ok: false, error: 'dates_inversees' })
    const r = cleanLigneInput({
      intitule: 'Accès privilégiés', prisme: 'PERIMETRE', debut: '2027-03-01', fin: '2027-04-15', charge: 12, priorite: 2,
      cibles: { organisations: ['f1', 'f1', 'f2'], entites: ['e1', 'e1'], tiers: ['t1'], risques: ['r1', 'r2'], processus: ['p1'], referentiel: { code: 'ISO27001', exigences: ['A.5.15', 'A.8.2', 'A.5.15'] } },
      echantillon: { methode: 'RISQUE', population: 40, taille: 8 },
    }, 2027, 'RISQUE')
    expect(r).toEqual({ ok: true, ligne: {
      intitule: 'Accès privilégiés', prisme: 'PERIMETRE', debut: '2027-03-01', fin: '2027-04-15', charge: 12, priorite: 2, responsable: null,
      cibles: { organisations: ['f1', 'f2'], entites: ['e1'], tiers: ['t1'], risques: ['r1', 'r2'], processus: ['p1'], referentiel: { code: 'ISO27001', exigences: ['A.5.15', 'A.8.2'] } },
      echantillon: { methode: 'RISQUE', population: 40, taille: 8 }, statutManuel: null,
    } })
    // Prisme absent ⇒ celui du plan ; échantillon incohérent (taille > population) refusé.
    expect(cleanLigneInput({ intitule: 'B' }, 2027, 'RISQUE')).toMatchObject({ ok: true, ligne: { prisme: 'RISQUE', echantillon: null } })
    expect(cleanLigneInput({ intitule: 'C', echantillon: { methode: 'ALEATOIRE', population: 5, taille: 9 } }, 2027, 'RISQUE')).toEqual({ ok: false, error: 'echantillon_invalide' })
  })
})

describe('cycle de validation du plan annuel', () => {
  const cfg = DEFAULT_PLANIFICATION
  it('préparation et validation selon les rôles configurés (audit / contrôle)', () => {
    expect(peutPreparer('AUDITEUR', 'AUDIT', cfg)).toBe(true)
    expect(peutPreparer('CONTROLEUR', 'AUDIT', cfg)).toBe(false)
    expect(peutValider('DIRECTION_METIER', 'AUDIT', cfg)).toBe(true)
    expect(peutValider('RSSI', 'CONTROLE', cfg)).toBe(true)
    expect(peutValider('AUDITEUR', 'AUDIT', cfg)).toBe(false)
    // Le super-administrateur a les droits de l'administrateur.
    expect(peutValider('SUPER_ADMIN', 'AUDIT', cfg)).toBe(true)
  })
  it('lignes modifiables : en brouillon ou révision (figé) ; toujours hors soumission (dynamique)', () => {
    expect(peutModifierLignes('BROUILLON', 'FIGE')).toBe(true)
    expect(peutModifierLignes('VALIDE', 'FIGE')).toBe(false)
    expect(peutModifierLignes('REVISION', 'FIGE')).toBe(true)
    expect(peutModifierLignes('VALIDE', 'DYNAMIQUE')).toBe(true)
    expect(peutModifierLignes('SOUMIS', 'DYNAMIQUE')).toBe(false)
  })
  const ctx = (o: Partial<Parameters<typeof transitionPlanAnnee>[2]> = {}) => ({ type: 'AUDIT' as const, mode: 'FIGE' as const, role: 'AUDITEUR' as const, userId: 'u1', preparePar: null, config: cfg, ...o })
  it('soumettre (préparateur) → valider (validateur) → réviser avec motif (plan figé)', () => {
    expect(transitionPlanAnnee('BROUILLON', { action: 'SOUMETTRE' }, ctx())).toEqual({ ok: true, statut: 'SOUMIS', patch: { preparePar: 'u1' } })
    expect(transitionPlanAnnee('BROUILLON', { action: 'SOUMETTRE' }, ctx({ role: 'RSSI' }))).toEqual({ ok: false, error: 'role_preparateur_requis' })
    expect(transitionPlanAnnee('SOUMIS', { action: 'VALIDER' }, ctx({ role: 'DIRECTION_METIER', userId: 'd1', preparePar: 'u1' }))).toEqual({ ok: true, statut: 'VALIDE', patch: { validePar: 'd1' }, figer: true })
    expect(transitionPlanAnnee('SOUMIS', { action: 'VALIDER' }, ctx({ role: 'AUDITEUR' }))).toEqual({ ok: false, error: 'role_validateur_requis' })
    expect(transitionPlanAnnee('SOUMIS', { action: 'RENVOYER', commentaire: 'Compléter' }, ctx({ role: 'ADMIN', userId: 'a1' }))).toEqual({ ok: true, statut: 'BROUILLON', patch: {} })
    expect(transitionPlanAnnee('VALIDE', { action: 'REVISER' }, ctx())).toEqual({ ok: false, error: 'motif_requis' })
    expect(transitionPlanAnnee('VALIDE', { action: 'REVISER', motif: 'Nouvelle filiale' }, ctx())).toEqual({ ok: true, statut: 'REVISION', patch: { motifRevision: 'Nouvelle filiale' }, revision: true })
    expect(transitionPlanAnnee('VALIDE', { action: 'SOUMETTRE' }, ctx())).toEqual({ ok: false, error: 'transition_interdite' })
  })
  it('plan dynamique : nouvelle validation (jalon) depuis un plan validé, motif facultatif', () => {
    expect(transitionPlanAnnee('VALIDE', { action: 'SOUMETTRE' }, ctx({ mode: 'DYNAMIQUE' }))).toEqual({ ok: true, statut: 'SOUMIS', patch: { preparePar: 'u1' } })
  })
  it('double regard (désactivé par défaut) : le préparateur ne valide pas son propre plan', () => {
    const v = ctx({ role: 'ADMIN', userId: 'u1', preparePar: 'u1' })
    expect(transitionPlanAnnee('SOUMIS', { action: 'VALIDER' }, v)).toMatchObject({ ok: true, statut: 'VALIDE' })
    expect(transitionPlanAnnee('SOUMIS', { action: 'VALIDER' }, { ...v, config: { ...cfg, doubleRegard: true } })).toEqual({ ok: false, error: 'double_regard' })
  })
  it('contenu figé : lignes de l’année, sans identifiants techniques de date', () => {
    const f = figerLignes([{ id: 'l1', intitule: 'A', prisme: 'RISQUE', cibles: { risques: ['r1'] }, echantillon: null, debut: new Date('2027-03-01T00:00:00Z'), fin: null, charge: 5, priorite: 1, responsable: 'X', statutManuel: null }])
    expect(f).toEqual([{ id: 'l1', intitule: 'A', prisme: 'RISQUE', cibles: { risques: ['r1'] }, echantillon: null, debut: '2027-03-01', fin: null, charge: 5, priorite: 1, responsable: 'X', statutManuel: null }])
  })
})

describe('graphique annuel (frise des 12 mois)', () => {
  it('période → position et largeur en % de l’année ; sans date de début : pas de barre ; sans fin : un jour, largeur minimale', async () => {
    const { positionFrise } = await import('@/lib/planification')
    expect(positionFrise('2027-01-01', '2027-12-31', 2027)).toEqual({ gauche: 0, largeur: 100 })
    const juillet = positionFrise('2027-07-01', '2027-07-31', 2027)!
    expect(juillet.gauche).toBeCloseTo(49.6, 1); expect(juillet.largeur).toBeCloseTo(8.5, 1)
    expect(positionFrise(null, '2027-03-01', 2027)).toBeNull()
    expect(positionFrise('2027-03-01', null, 2027)!.largeur).toBeGreaterThanOrEqual(1)
    // Année bissextile : 366 jours.
    expect(positionFrise('2028-12-31', '2028-12-31', 2028)!.gauche).toBeCloseTo(99.7, 1)
  })
})

describe('réalisations (lot P4)', () => {
  it('rattachements : types connus, dédoublonnés, bornés', async () => {
    const { cleanRealisations } = await import('@/lib/planification')
    expect(cleanRealisations([{ type: 'MISSION', id: 'm1' }, { type: 'MISSION', id: 'm1' }, { type: 'X', id: 'y' }, { type: 'CONTROLE', id: '' }, 'z'])).toEqual([{ type: 'MISSION', id: 'm1' }])
  })
  it('statut d’une ligne : manuel d’abord, puis réalisations, puis période', async () => {
    const { statutLigne } = await import('@/lib/planification')
    const l = { debut: '2027-03-01', fin: '2027-03-31', statutManuel: null }
    const jour = '2027-06-01'
    expect(statutLigne({ ...l, statutManuel: 'ANNULEE' }, [{ statut: 'CLOTUREE' }], jour)).toBe('ANNULEE')
    expect(statutLigne(l, [{ statut: 'CLOTUREE' }, { statut: 'EXECUTE' }], jour)).toBe('REALISEE')
    expect(statutLigne(l, [{ statut: 'CLOTUREE' }, { statut: 'EN_COURS' }], jour)).toBe('EN_COURS')
    expect(statutLigne(l, [{ statut: 'PLANIFIEE' }], jour)).toBe('EN_RETARD')
    expect(statutLigne(l, [], '2027-03-10')).toBe('EN_COURS')
    expect(statutLigne(l, [], '2027-01-10')).toBe('A_VENIR')
    expect(statutLigne({ debut: null, fin: null, statutManuel: null }, [], jour)).toBe('A_VENIR')
  })
  it('rapprochements proposés : processus ou risques en commun, période dans l’année ; les plus proches d’abord', async () => {
    const { suggererRealisations } = await import('@/lib/planification')
    const ligne = { debut: '2027-03-01', fin: '2027-03-31', cibles: { processus: ['p1'], risques: ['r1'] } }
    const s = suggererRealisations(ligne, 2027, [
      { type: 'MISSION', id: 'm1', intitule: 'Audit paie', processus: ['p1'], risques: [], debut: '2027-03-10', fin: '2027-04-10' },
      { type: 'CONTROLE', id: 'c1', intitule: 'Revue des accès', processus: [], risques: ['r1'], debut: '2027-08-01', fin: null },
      { type: 'MISSION', id: 'm2', intitule: 'Audit achats', processus: ['p9'], risques: [], debut: '2027-03-01', fin: null },
      { type: 'MISSION', id: 'm3', intitule: 'Audit paie 2025', processus: ['p1'], risques: [], debut: '2025-03-01', fin: '2025-04-01' },
    ])
    expect(s.map(x => x.id)).toEqual(['m1', 'c1'])
  })
  it('taux de réalisation : lignes actives (hors annulées et reportées)', async () => {
    const { tauxRealisation } = await import('@/lib/planification')
    expect(tauxRealisation(['REALISEE', 'REALISEE', 'EN_RETARD', 'A_VENIR', 'ANNULEE', 'REPORTEE'])).toEqual({ actives: 4, realisees: 2, enRetard: 1, taux: 50 })
    expect(tauxRealisation([])).toEqual({ actives: 0, realisees: 0, enRetard: 0, taux: null })
  })
})
