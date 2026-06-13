import { describe, it, expect } from 'vitest'
import {
  canCreateAnalyse,
  canAdmin,
  canConfigurer,
  canEditConfig,
  canViewAnalyse,
  canEditAnalyse,
  canSubmitAnalyse,
  canApproveAnalyse,
  canManageAccess,
  type SessionUser,
  type AnalyseOwnership,
} from '@/lib/permissions'

// Helpers
const userWith = (role: SessionUser['role'] | 'RSSI', id = 'u1'): SessionUser => ({ id, role: role as SessionUser['role'] })
const ownedBy = (userId: string, accesUtilisateurs?: AnalyseOwnership['accesUtilisateurs']): AnalyseOwnership => ({
  userId,
  accesUtilisateurs,
})

// ─── canCreateAnalyse ─────────────────────────────────────────────────────────
describe('canCreateAnalyse', () => {
  it('autorise ANALYSTE et ADMIN', () => {
    expect(canCreateAnalyse(userWith('ANALYSTE'))).toBe(true)
    expect(canCreateAnalyse(userWith('ADMIN'))).toBe(true)
  })
  it('bloque LECTEUR et RISK_MANAGER', () => {
    expect(canCreateAnalyse(userWith('LECTEUR'))).toBe(false)
    expect(canCreateAnalyse(userWith('RISK_MANAGER'))).toBe(false)
  })
})

// ─── canAdmin ─────────────────────────────────────────────────────────────────
describe('canAdmin', () => {
  it('autorise uniquement ADMIN', () => {
    expect(canAdmin(userWith('ADMIN'))).toBe(true)
    expect(canAdmin(userWith('ANALYSTE'))).toBe(false)
    expect(canAdmin(userWith('RISK_MANAGER'))).toBe(false)
    expect(canAdmin(userWith('LECTEUR'))).toBe(false)
  })
})

// ─── canConfigurer ───────────────────────────────────────────────────────────
describe('canConfigurer', () => {
  it('autorise ANALYSTE, RISK_MANAGER, RSSI, ADMIN', () => {
    expect(canConfigurer(userWith('ANALYSTE'))).toBe(true)
    expect(canConfigurer(userWith('RISK_MANAGER'))).toBe(true)
    expect(canConfigurer(userWith('RSSI'))).toBe(true)
    expect(canConfigurer(userWith('ADMIN'))).toBe(true)
  })
  it('bloque LECTEUR', () => {
    expect(canConfigurer(userWith('LECTEUR'))).toBe(false)
  })
})

// ─── canEditConfig ────────────────────────────────────────────────────────────
describe('canEditConfig', () => {
  it('autorise uniquement ADMIN à modifier les échelles', () => {
    expect(canEditConfig(userWith('ADMIN'))).toBe(true)
  })
  it('bloque ANALYSTE, RISK_MANAGER, RSSI, LECTEUR', () => {
    expect(canEditConfig(userWith('ANALYSTE'))).toBe(false)
    expect(canEditConfig(userWith('RISK_MANAGER'))).toBe(false)
    expect(canEditConfig(userWith('RSSI'))).toBe(false)
    expect(canEditConfig(userWith('LECTEUR'))).toBe(false)
  })
})

// ─── canViewAnalyse ───────────────────────────────────────────────────────────
describe('canViewAnalyse', () => {
  it('ADMIN et RISK_MANAGER voient toutes les analyses', () => {
    const analyse = ownedBy('other-user')
    expect(canViewAnalyse(userWith('ADMIN'), analyse)).toBe(true)
    expect(canViewAnalyse(userWith('RISK_MANAGER'), analyse)).toBe(true)
  })
  it('le propriétaire peut voir son analyse', () => {
    const user = userWith('ANALYSTE', 'u1')
    expect(canViewAnalyse(user, ownedBy('u1'))).toBe(true)
  })
  it('un LECTEUR ne voit pas une analyse sans accès explicite', () => {
    const user = userWith('LECTEUR', 'u2')
    expect(canViewAnalyse(user, ownedBy('u1'))).toBe(false)
  })
  it('accès granulaire LECTURE permet la lecture', () => {
    const user = userWith('LECTEUR', 'u2')
    const analyse = ownedBy('u1', [{ userId: 'u2', permission: 'LECTURE' }])
    expect(canViewAnalyse(user, analyse)).toBe(true)
  })
})

// ─── canEditAnalyse ───────────────────────────────────────────────────────────
describe('canEditAnalyse', () => {
  it('ADMIN peut toujours éditer', () => {
    expect(canEditAnalyse(userWith('ADMIN'), ownedBy('u1'))).toBe(true)
  })
  it('ANALYSTE propriétaire peut éditer', () => {
    const user = userWith('ANALYSTE', 'u1')
    expect(canEditAnalyse(user, ownedBy('u1'))).toBe(true)
  })
  it('RISK_MANAGER propriétaire ne peut pas éditer (pas analyste)', () => {
    const user = userWith('RISK_MANAGER', 'u1')
    expect(canEditAnalyse(user, ownedBy('u1'))).toBe(false)
  })
  it('accès granulaire EDITION permet l\'édition', () => {
    const user = userWith('LECTEUR', 'u2')
    const analyse = ownedBy('u1', [{ userId: 'u2', permission: 'EDITION' }])
    expect(canEditAnalyse(user, analyse)).toBe(true)
  })
  it('accès granulaire LECTURE ne permet pas l\'édition', () => {
    const user = userWith('ANALYSTE', 'u2')
    const analyse = ownedBy('u1', [{ userId: 'u2', permission: 'LECTURE' }])
    expect(canEditAnalyse(user, analyse)).toBe(false)
  })
})

// ─── canSubmitAnalyse ─────────────────────────────────────────────────────────
describe('canSubmitAnalyse', () => {
  it('ANALYSTE propriétaire peut soumettre', () => {
    const user = userWith('ANALYSTE', 'u1')
    expect(canSubmitAnalyse(user, ownedBy('u1'))).toBe(true)
  })
  it('ANALYSTE non-propriétaire ne peut pas soumettre', () => {
    const user = userWith('ANALYSTE', 'u2')
    expect(canSubmitAnalyse(user, ownedBy('u1'))).toBe(false)
  })
  it('RISK_MANAGER propriétaire ne peut pas soumettre', () => {
    const user = userWith('RISK_MANAGER', 'u1')
    expect(canSubmitAnalyse(user, ownedBy('u1'))).toBe(false)
  })
  it('ADMIN peut toujours soumettre', () => {
    expect(canSubmitAnalyse(userWith('ADMIN'), ownedBy('u1'))).toBe(true)
  })
})

// ─── canApproveAnalyse ────────────────────────────────────────────────────────
describe('canApproveAnalyse', () => {
  it('ADMIN peut toujours approuver', () => {
    expect(canApproveAnalyse(userWith('ADMIN'), ownedBy('u1'))).toBe(true)
  })
  it('RISK_MANAGER sans restriction peut approuver', () => {
    expect(canApproveAnalyse(userWith('RISK_MANAGER', 'u2'), ownedBy('u1'))).toBe(true)
  })
  it('RSSI peut approuver (même logique que RISK_MANAGER)', () => {
    expect(canApproveAnalyse(userWith('RSSI', 'u2'), ownedBy('u1'))).toBe(true)
  })
  it('RSSI avec permission APPROBATION peut approuver', () => {
    const user = userWith('RSSI', 'u2')
    const analyse = ownedBy('u1', [{ userId: 'u2', permission: 'APPROBATION' }])
    expect(canApproveAnalyse(user, analyse)).toBe(true)
  })
  it('RSSI avec permission LECTURE seule ne peut PAS approuver', () => {
    const user = userWith('RSSI', 'u2')
    const analyse = ownedBy('u1', [{ userId: 'u2', permission: 'LECTURE' }])
    expect(canApproveAnalyse(user, analyse)).toBe(false)
  })
  it('ANALYSTE ne peut pas approuver', () => {
    expect(canApproveAnalyse(userWith('ANALYSTE'), ownedBy('u1'))).toBe(false)
  })
  it('LECTEUR ne peut pas approuver', () => {
    expect(canApproveAnalyse(userWith('LECTEUR'), ownedBy('u1'))).toBe(false)
  })
  it('RISK_MANAGER avec permission APPROBATION peut approuver', () => {
    const user = userWith('RISK_MANAGER', 'u2')
    const analyse = ownedBy('u1', [{ userId: 'u2', permission: 'APPROBATION' }])
    expect(canApproveAnalyse(user, analyse)).toBe(true)
  })
})

// ─── canManageAccess ──────────────────────────────────────────────────────────
describe('canManageAccess', () => {
  it('ADMIN peut gérer tous les accès', () => {
    expect(canManageAccess(userWith('ADMIN'), ownedBy('u1'))).toBe(true)
  })
  it('le propriétaire peut gérer ses accès', () => {
    const user = userWith('ANALYSTE', 'u1')
    expect(canManageAccess(user, ownedBy('u1'))).toBe(true)
  })
  it('un non-propriétaire ne peut pas gérer les accès', () => {
    const user = userWith('ANALYSTE', 'u2')
    expect(canManageAccess(user, ownedBy('u1'))).toBe(false)
  })
})
