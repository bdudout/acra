import { describe, it, expect } from 'vitest'
import { RELANCES_DEFAUT, sanitizeRelancesConfig, typeRelance, relanceAttenteDue, approbateursAnalyse, valideursDerogation, attenteDerogationDepuis } from '@/lib/relances'

const J = 86_400_000
const now = new Date('2026-10-01T06:00:00Z')
const jour = (n: number) => new Date(now.getTime() + n * J)
const item = (o: Partial<{ echeance: Date | null; rappelLe: Date | null; createdAt: Date }>) => ({ echeance: null, rappelLe: null, createdAt: jour(-1), ...o })

describe('configuration des relances', () => {
  it('par défaut : actives, 14 jours avant l’échéance, puis tous les mois', () => {
    expect(RELANCES_DEFAUT).toEqual({ actives: true, joursAvant: 14, periodiciteJours: 30, attenteJours: 7, tableauBordMensuel: true })
    expect(sanitizeRelancesConfig(undefined)).toEqual(RELANCES_DEFAUT)
  })
  it('borne les saisies ; 0 désactive la relance périodique', () => {
    expect(sanitizeRelancesConfig({ actives: false, joursAvant: 500, periodiciteJours: 0, x: 1 })).toEqual({ actives: false, joursAvant: 90, periodiciteJours: 0, attenteJours: 7, tableauBordMensuel: true })
    expect(sanitizeRelancesConfig({ joursAvant: 0, periodiciteJours: 3, attenteJours: 99 })).toEqual({ actives: true, joursAvant: 1, periodiciteJours: 7, attenteJours: 60, tableauBordMensuel: true })
  })
})

describe('typeRelance', () => {
  const cfg = RELANCES_DEFAUT
  it('rien si les relances sont désactivées', () => {
    expect(typeRelance(item({ echeance: jour(3) }), { ...cfg, actives: false }, now)).toBeNull()
  })
  it('échéance proche : une seule relance dans la fenêtre', () => {
    expect(typeRelance(item({ echeance: jour(10) }), cfg, now)).toBe('ECHEANCE_PROCHE')
    expect(typeRelance(item({ echeance: jour(10), rappelLe: jour(-2) }), cfg, now)).toBeNull()
    // Relancé avant d'entrer dans la fenêtre (relance périodique) : on relance à l'approche.
    expect(typeRelance(item({ echeance: jour(10), rappelLe: jour(-20) }), cfg, now)).toBe('ECHEANCE_PROCHE')
  })
  it('en retard : relance au dépassement, puis selon la périodicité', () => {
    expect(typeRelance(item({ echeance: jour(-1), rappelLe: jour(-5) }), cfg, now)).toBe('EN_RETARD')
    expect(typeRelance(item({ echeance: jour(-10), rappelLe: jour(-3) }), cfg, now)).toBeNull()
    expect(typeRelance(item({ echeance: jour(-60), rappelLe: jour(-30) }), cfg, now)).toBe('EN_RETARD')
  })
  it('relance périodique (mensuelle par défaut) tant que l’élément est ouvert, échéance lointaine ou absente', () => {
    expect(typeRelance(item({ createdAt: jour(-10) }), cfg, now)).toBeNull()
    expect(typeRelance(item({ createdAt: jour(-31) }), cfg, now)).toBe('PERIODIQUE')
    expect(typeRelance(item({ echeance: jour(90), createdAt: jour(-40), rappelLe: jour(-29) }), cfg, now)).toBeNull()
    expect(typeRelance(item({ echeance: jour(90), createdAt: jour(-40), rappelLe: jour(-30) }), cfg, now)).toBe('PERIODIQUE')
    expect(typeRelance(item({ createdAt: jour(-400) }), { ...cfg, periodiciteJours: 0 }, now)).toBeNull()
  })
  it('sans périodicité, le retard n’est relancé qu’une fois', () => {
    const c = { ...cfg, periodiciteJours: 0 }
    expect(typeRelance(item({ echeance: jour(-2), rappelLe: jour(-10) }), c, now)).toBe('EN_RETARD')
    expect(typeRelance(item({ echeance: jour(-20), rappelLe: jour(-10) }), c, now)).toBeNull()
  })
})

describe('relanceAttenteDue (validation ou vérification en attente)', () => {
  const cfg = RELANCES_DEFAUT
  it('première relance après « attenteJours » d’attente, puis selon la périodicité', () => {
    expect(relanceAttenteDue({ depuis: jour(-3), rappelLe: null }, cfg, now)).toBe(false)
    expect(relanceAttenteDue({ depuis: jour(-7), rappelLe: null }, cfg, now)).toBe(true)
    expect(relanceAttenteDue({ depuis: jour(-20), rappelLe: jour(-10) }, cfg, now)).toBe(false)
    expect(relanceAttenteDue({ depuis: jour(-50), rappelLe: jour(-30) }, cfg, now)).toBe(true)
  })
  it('une nouvelle attente (re-soumission) repart du début ; rien si relances inactives ; 0 = une seule relance', () => {
    expect(relanceAttenteDue({ depuis: jour(-8), rappelLe: jour(-40) }, cfg, now)).toBe(true)
    expect(relanceAttenteDue({ depuis: jour(-2), rappelLe: jour(-40) }, cfg, now)).toBe(false)
    expect(relanceAttenteDue({ depuis: jour(-30), rappelLe: null }, { ...cfg, actives: false }, now)).toBe(false)
    expect(relanceAttenteDue({ depuis: jour(-300), rappelLe: jour(-100) }, { ...cfg, periodiciteJours: 0 }, now)).toBe(false)
  })
})

describe('destinataires des décisions en attente', () => {
  const membres = [
    { userId: 'rssi', role: 'RSSI' }, { userId: 'rssi2', role: 'RSSI' }, { userId: 'rm', role: 'RISK_MANAGER' },
    { userId: 'dm', role: 'DIRECTION_METIER' }, { userId: 'adm', role: 'ADMIN' }, { userId: 'ana', role: 'ANALYSTE' },
  ]
  it('analyse : RSSI et Risk Manager, jamais l’auteur ni un accès restreint ; projet 360 : rôle manquant seulement', () => {
    expect(approbateursAnalyse(membres, { auteurId: 'rm', projet360: false, rolesDejaApprouves: [], acces: [{ userId: 'rssi2', permission: 'LECTURE' }] })).toEqual(['rssi'])
    expect(approbateursAnalyse(membres, { auteurId: 'ana', projet360: true, rolesDejaApprouves: ['RISK_MANAGER'], acces: [] })).toEqual(['rssi', 'rssi2'])
    expect(approbateursAnalyse([{ userId: 'adm', role: 'ADMIN' }, { userId: 'ana', role: 'ANALYSTE' }], { auteurId: 'ana', projet360: false, rolesDejaApprouves: [], acces: [] })).toEqual(['adm'])
  })
  it('dérogation : RSSI pour l’avis et le double regard (quatre-yeux), direction métier pour la validation', () => {
    expect(valideursDerogation(membres, { statut: 'DEMANDEE', demandeurId: 'rssi', avisRssiPar: null })).toEqual(['rssi2'])
    expect(valideursDerogation(membres, { statut: 'DOUBLE_REGARD', demandeurId: 'ana', avisRssiPar: 'rssi' })).toEqual(['rssi2'])
    expect(valideursDerogation(membres, { statut: 'VALIDATION_METIER', demandeurId: 'ana', avisRssiPar: 'rssi' })).toEqual(['dm'])
    expect(valideursDerogation(membres.filter(m => m.role !== 'DIRECTION_METIER'), { statut: 'VALIDATION_METIER', demandeurId: 'ana', avisRssiPar: null })).toEqual(['adm'])
    expect(valideursDerogation(membres, { statut: 'ACTIVE', demandeurId: 'ana', avisRssiPar: null })).toEqual([])
  })
  it('début d’attente d’une dérogation selon l’étape et les prolongations', () => {
    const base = { createdAt: jour(-60), avisRssiLe: jour(-20), doubleRegardLe: jour(-10), prolongationDemandee: null, prolongations: [] }
    expect(attenteDerogationDepuis({ ...base, statut: 'DEMANDEE' })).toEqual(jour(-60))
    expect(attenteDerogationDepuis({ ...base, statut: 'DOUBLE_REGARD' })).toEqual(jour(-20))
    expect(attenteDerogationDepuis({ ...base, statut: 'VALIDATION_METIER' })).toEqual(jour(-10))
    expect(attenteDerogationDepuis({ ...base, statut: 'DEMANDEE', prolongationDemandee: jour(90), prolongations: [{ le: jour(-5).toISOString() }] })).toEqual(jour(-5))
  })
})

