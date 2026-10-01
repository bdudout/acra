import { describe, it, expect } from 'vitest'
import { RELANCES_DEFAUT, sanitizeRelancesConfig, typeRelance } from '@/lib/relances'

const J = 86_400_000
const now = new Date('2026-10-01T06:00:00Z')
const jour = (n: number) => new Date(now.getTime() + n * J)
const item = (o: Partial<{ echeance: Date | null; rappelLe: Date | null; createdAt: Date }>) => ({ echeance: null, rappelLe: null, createdAt: jour(-1), ...o })

describe('configuration des relances', () => {
  it('par défaut : actives, 14 jours avant l’échéance, puis tous les mois', () => {
    expect(RELANCES_DEFAUT).toEqual({ actives: true, joursAvant: 14, periodiciteJours: 30 })
    expect(sanitizeRelancesConfig(undefined)).toEqual(RELANCES_DEFAUT)
  })
  it('borne les saisies ; 0 désactive la relance périodique', () => {
    expect(sanitizeRelancesConfig({ actives: false, joursAvant: 500, periodiciteJours: 0, x: 1 })).toEqual({ actives: false, joursAvant: 90, periodiciteJours: 0 })
    expect(sanitizeRelancesConfig({ joursAvant: 0, periodiciteJours: 3 })).toEqual({ actives: true, joursAvant: 1, periodiciteJours: 7 })
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
