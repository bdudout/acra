import { describe, it, expect } from 'vitest'
// Import relatif volontaire : sous Node 26 l'alias @/ casse vitest sur l'hôte.
import {
  DEMO_DEFAULTS,
  orgExpiresAt,
  isOrgExpired,
  daysUntilPurge,
  shouldWarn,
  decideInstanceMode,
  analysisCapReached,
  requiresEmailVerification,
} from '../../../lib/demo'

const DAY = 24 * 60 * 60 * 1000
const cfg = DEMO_DEFAULTS // inactivité 30 j, cap 90 j, préavis 7 j

describe('demo — logique d\'expiration', () => {
  it('expose les défauts (inactivité 30, cap dur 90, préavis 7, caps)', () => {
    expect(DEMO_DEFAULTS.inactivityDays).toBe(30)
    expect(DEMO_DEFAULTS.hardCapDays).toBe(90)
    expect(DEMO_DEFAULTS.warningDays).toBe(7)
    expect(DEMO_DEFAULTS.maxAnalysesPerOrg).toBeGreaterThan(0)
    expect(DEMO_DEFAULTS.maxActiveOrgs).toBeGreaterThan(0)
  })

  describe('orgExpiresAt = min(inactivité, cap dur)', () => {
    it('fenêtre d\'inactivité gagnante (org récente, inactive)', () => {
      const created = new Date('2026-01-01T00:00:00Z')
      const lastActivity = new Date('2026-02-01T00:00:00Z')
      // inactivité : 01-02 + 30 j = 03-03 ; cap : 01-01 + 90 j = 04-01 → min 03-03
      expect(orgExpiresAt({ createdAt: created, lastActivityAt: lastActivity }, cfg).toISOString())
        .toBe(new Date(lastActivity.getTime() + 30 * DAY).toISOString())
    })
    it('cap dur gagnant (org ancienne mais restée active)', () => {
      const created = new Date('2026-01-01T00:00:00Z')
      const lastActivity = new Date('2026-03-25T00:00:00Z') // active récemment
      // cap : 01-01 + 90 j = 04-01 ; inactivité : 03-25 + 30 j = 04-24 → min 04-01
      expect(orgExpiresAt({ createdAt: created, lastActivityAt: lastActivity }, cfg).toISOString())
        .toBe(new Date(created.getTime() + 90 * DAY).toISOString())
    })
    it('lastActivityAt absent → retombe sur createdAt', () => {
      const created = new Date('2026-01-01T00:00:00Z')
      expect(orgExpiresAt({ createdAt: created, lastActivityAt: null }, cfg).toISOString())
        .toBe(new Date(created.getTime() + 30 * DAY).toISOString())
    })
  })

  describe('isOrgExpired', () => {
    const org = { createdAt: new Date('2026-01-01T00:00:00Z'), lastActivityAt: new Date('2026-01-01T00:00:00Z') }
    it('non expiré avant la date de purge', () => {
      expect(isOrgExpired(org, cfg, new Date('2026-01-20T00:00:00Z'))).toBe(false)
    })
    it('expiré après la date de purge', () => {
      expect(isOrgExpired(org, cfg, new Date('2026-02-15T00:00:00Z'))).toBe(true)
    })
  })

  describe('daysUntilPurge', () => {
    const org = { createdAt: new Date('2026-01-01T00:00:00Z'), lastActivityAt: new Date('2026-01-01T00:00:00Z') }
    it('compte les jours restants (arrondi haut)', () => {
      // expire 31-01 ; à 21-01 → 10 j
      expect(daysUntilPurge(org, cfg, new Date('2026-01-21T00:00:00Z'))).toBe(10)
    })
    it('0 si déjà expiré', () => {
      expect(daysUntilPurge(org, cfg, new Date('2026-03-01T00:00:00Z'))).toBe(0)
    })
  })

  describe('shouldWarn (préavis)', () => {
    const org = { createdAt: new Date('2026-01-01T00:00:00Z'), lastActivityAt: new Date('2026-01-01T00:00:00Z') }
    it('avertit dans la fenêtre de préavis (≤ 7 j)', () => {
      expect(shouldWarn(org, cfg, new Date('2026-01-28T00:00:00Z'))).toBe(true) // 3 j restants
    })
    it('n\'avertit pas trop tôt', () => {
      expect(shouldWarn(org, cfg, new Date('2026-01-10T00:00:00Z'))).toBe(false) // 21 j restants
    })
    it('n\'avertit pas une org déjà expirée (elle sera purgée)', () => {
      expect(shouldWarn(org, cfg, new Date('2026-03-01T00:00:00Z'))).toBe(false)
    })
  })
})

// Sécurité anti-bascule : une instance de PROD ne doit JAMAIS devenir une instance
// de démo (sinon la purge auto détruirait de vraies données). Le marqueur d'instance
// est décidé une fois puis figé ; on ne peut passer en DEMO que sur une instance
// vierge stampée démo dès l'origine.
describe('decideInstanceMode — garde-fou prod → démo', () => {
  it('marqueur DEMO existant → reste DEMO, sans réécriture, sans refus', () => {
    expect(decideInstanceMode({ envDemo: true, marker: 'DEMO', hasRealData: true }))
      .toEqual({ mode: 'DEMO', persist: false, refusedDemo: false })
  })

  it('marqueur PROD existant + env démo → RESTE PROD (immuable) et signale un refus', () => {
    // Cas critique : quelqu\'un a posé ACRA_DEMO_MODE=true sur une instance de prod.
    expect(decideInstanceMode({ envDemo: true, marker: 'PROD', hasRealData: true }))
      .toEqual({ mode: 'PROD', persist: false, refusedDemo: true })
  })

  it('marqueur PROD existant + env non-démo → PROD, rien à signaler', () => {
    expect(decideInstanceMode({ envDemo: false, marker: 'PROD', hasRealData: true }))
      .toEqual({ mode: 'PROD', persist: false, refusedDemo: false })
  })

  it('aucun marqueur + env démo + instance vierge → stampe DEMO', () => {
    expect(decideInstanceMode({ envDemo: true, marker: null, hasRealData: false }))
      .toEqual({ mode: 'DEMO', persist: true, refusedDemo: false })
  })

  it('aucun marqueur + env démo MAIS données réelles déjà présentes → stampe PROD + refus', () => {
    // Défense en profondeur : on n\'accepte pas de convertir en démo une instance
    // qui contient déjà des organisations/analyses réelles.
    expect(decideInstanceMode({ envDemo: true, marker: null, hasRealData: true }))
      .toEqual({ mode: 'PROD', persist: true, refusedDemo: true })
  })

  it('aucun marqueur + env non-démo → stampe PROD', () => {
    expect(decideInstanceMode({ envDemo: false, marker: null, hasRealData: false }))
      .toEqual({ mode: 'PROD', persist: true, refusedDemo: false })
  })
})

describe('analysisCapReached — plafond d\'analyses par org démo', () => {
  it('faux sous le plafond', () => {
    expect(analysisCapReached(DEMO_DEFAULTS.maxAnalysesPerOrg - 1, DEMO_DEFAULTS)).toBe(false)
  })
  it('vrai au plafond (le suivant est refusé)', () => {
    expect(analysisCapReached(DEMO_DEFAULTS.maxAnalysesPerOrg, DEMO_DEFAULTS)).toBe(true)
  })
  it('vrai au-delà du plafond', () => {
    expect(analysisCapReached(DEMO_DEFAULTS.maxAnalysesPerOrg + 5, DEMO_DEFAULTS)).toBe(true)
  })
})

describe('requiresEmailVerification — blocage connexion démo tant que non vérifié', () => {
  it('démo + e-mail non vérifié → bloque', () => {
    expect(requiresEmailVerification(true, null)).toBe(true)
    expect(requiresEmailVerification(true, undefined)).toBe(true)
  })
  it('démo + e-mail vérifié → autorise', () => {
    expect(requiresEmailVerification(true, new Date())).toBe(false)
  })
  it('hors démo → jamais bloqué (même si non vérifié)', () => {
    expect(requiresEmailVerification(false, null)).toBe(false)
  })
})
