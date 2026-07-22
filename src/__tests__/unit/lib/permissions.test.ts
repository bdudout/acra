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
  canAcceptResidualRisks,
  analyseWhereClause,
  type SessionUser,
  type AnalyseOwnership,
} from '@/lib/permissions'

// Helpers
const userWith = (role: SessionUser['role'] | 'RSSI', id = 'u1'): SessionUser => ({ id, role: role as SessionUser['role'] })
const ownedBy = (userId: string, accesUtilisateurs?: AnalyseOwnership['accesUtilisateurs']): AnalyseOwnership => ({
  userId,
  accesUtilisateurs,
})

// ─── analyseWhereClause — exclusion de la corbeille (soft delete) ─────────────
describe('analyseWhereClause exclut toujours les analyses en corbeille', () => {
  it('ajoute deletedAt: null pour tous les rôles (ADMIN inclus)', () => {
    for (const role of ['ADMIN', 'RSSI', 'RISK_MANAGER', 'ANALYSTE', 'LECTEUR'] as const) {
      const w = analyseWhereClause('u1', role) as Record<string, unknown>
      expect(w.deletedAt).toBe(null)
    }
  })
  it('ADMIN voit tout sauf la corbeille (pas de restriction de propriété)', () => {
    expect(analyseWhereClause('u1', 'ADMIN')).toEqual({ deletedAt: null })
  })
  it('ANALYSTE est restreint à ses analyses + partagées, hors corbeille', () => {
    const w = analyseWhereClause('u1', 'ANALYSTE') as Record<string, unknown>
    expect(w.deletedAt).toBe(null)
    expect(Array.isArray(w.OR)).toBe(true)
  })
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
  it('autorise ADMIN et SUPER_ADMIN (accès /admin scopé à l’org)', () => {
    expect(canAdmin(userWith('ADMIN'))).toBe(true)
    expect(canAdmin(userWith('SUPER_ADMIN'))).toBe(true)
    expect(canAdmin(userWith('ANALYSTE'))).toBe(false)
    expect(canAdmin(userWith('RISK_MANAGER'))).toBe(false)
    expect(canAdmin(userWith('LECTEUR'))).toBe(false)
  })
})

// ─── Direction métier : lecture seule + acceptation des risques résiduels ─────
describe('DIRECTION_METIER', () => {
  const dm = userWith('DIRECTION_METIER')
  const foreign = ownedBy('someone-else')

  it('peut consulter n\'importe quelle analyse (lecture seule)', () => {
    expect(canViewAnalyse(dm, foreign)).toBe(true)
  })
  it('ne peut ni éditer, ni soumettre, ni approuver l\'analyse', () => {
    expect(canEditAnalyse(dm, foreign)).toBe(false)
    expect(canSubmitAnalyse(dm, foreign)).toBe(false)
    expect(canApproveAnalyse(dm, foreign)).toBe(false)
  })
  it('n\'est pas administrateur', () => {
    expect(canAdmin(dm)).toBe(false)
  })
})

describe('canAcceptResidualRisks', () => {
  it('Direction métier peut accepter si la fonctionnalité est active', () => {
    expect(canAcceptResidualRisks(userWith('DIRECTION_METIER'), true)).toBe(true)
  })
  it('les administrateurs le peuvent aussi', () => {
    expect(canAcceptResidualRisks(userWith('ADMIN'), true)).toBe(true)
    expect(canAcceptResidualRisks(userWith('SUPER_ADMIN'), true)).toBe(true)
  })
  it('personne ne le peut si la fonctionnalité est désactivée', () => {
    expect(canAcceptResidualRisks(userWith('DIRECTION_METIER'), false)).toBe(false)
    expect(canAcceptResidualRisks(userWith('ADMIN'), false)).toBe(false)
  })
  it('les autres rôles ne le peuvent pas (même si actif)', () => {
    expect(canAcceptResidualRisks(userWith('ANALYSTE'), true)).toBe(false)
    expect(canAcceptResidualRisks(userWith('RISK_MANAGER'), true)).toBe(false)
    expect(canAcceptResidualRisks(userWith('RSSI'), true)).toBe(false)
    expect(canAcceptResidualRisks(userWith('LECTEUR'), true)).toBe(false)
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

  // Séparation des tâches / quatre-yeux (#120, A01 / CWE-863) : un approbateur
  // ne peut pas approuver SA PROPRE analyse (maker-checker).
  it('RISK_MANAGER ne peut PAS approuver sa propre analyse (SoD)', () => {
    expect(canApproveAnalyse(userWith('RISK_MANAGER', 'u1'), ownedBy('u1'))).toBe(false)
  })
  it('RSSI ne peut PAS approuver sa propre analyse (SoD)', () => {
    expect(canApproveAnalyse(userWith('RSSI', 'u1'), ownedBy('u1'))).toBe(false)
  })
  it('RISK_MANAGER propriétaire même avec accès APPROBATION reste bloqué (SoD)', () => {
    const user = userWith('RISK_MANAGER', 'u1')
    const analyse = ownedBy('u1', [{ userId: 'u1', permission: 'APPROBATION' }])
    expect(canApproveAnalyse(user, analyse)).toBe(false)
  })
  it('ADMIN propriétaire conserve son override (flux mono-admin TPE)', () => {
    // L'auto-approbation ADMIN reste possible mais est journalisée (selfApproval) côté route.
    expect(canApproveAnalyse(userWith('ADMIN', 'u1'), ownedBy('u1'))).toBe(true)
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
