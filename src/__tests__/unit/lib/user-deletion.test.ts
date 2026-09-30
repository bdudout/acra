import { describe, it, expect } from 'vitest'
import { decideUserDeletion } from '@/lib/user-deletion'

// Audit 2026-09-30 : S1 (destruction inter-organisations), S4 (escalade SUPER_ADMIN), D1.
const base = {
  actorRole: 'ADMIN', actorAll: false, actorVisibleOrgIds: ['A'],
  targetRole: 'ANALYSTE', targetMembershipOrgIds: ['A'], otherActiveSuperAdmins: 1, ownedAnalyses: 0,
}

describe('decideUserDeletion', () => {
  it('supprime un compte entièrement dans le périmètre, sans analyse', () => {
    expect(decideUserDeletion(base)).toEqual({ action: 'DELETE' })
  })

  it('S4 — un ADMIN ne supprime jamais un SUPER_ADMIN', () => {
    expect(decideUserDeletion({ ...base, targetRole: 'SUPER_ADMIN' })).toMatchObject({ action: 'REFUSE', status: 403, code: 'SUPER_ADMIN_ONLY' })
  })

  it('S4 — le dernier SUPER_ADMIN actif n\'est pas supprimable, même par un SUPER_ADMIN', () => {
    expect(decideUserDeletion({ ...base, actorRole: 'SUPER_ADMIN', actorAll: true, targetRole: 'SUPER_ADMIN', otherActiveSuperAdmins: 0 }))
      .toMatchObject({ action: 'REFUSE', code: 'LAST_SUPER_ADMIN' })
    expect(decideUserDeletion({ ...base, actorRole: 'SUPER_ADMIN', actorAll: true, targetRole: 'SUPER_ADMIN', otherActiveSuperAdmins: 1 }))
      .toEqual({ action: 'DELETE' })
  })

  it('S1 — compte partagé avec une organisation hors périmètre : seules les appartenances du périmètre sont retirées', () => {
    expect(decideUserDeletion({ ...base, targetMembershipOrgIds: ['A', 'B'], ownedAnalyses: 12 }))
      .toEqual({ action: 'DETACH', organizationIds: ['A'] })
  })

  it('refuse un compte sans appartenance dans le périmètre', () => {
    expect(decideUserDeletion({ ...base, targetMembershipOrgIds: ['B'] })).toMatchObject({ action: 'REFUSE', status: 403, code: 'OUT_OF_SCOPE' })
    expect(decideUserDeletion({ ...base, targetMembershipOrgIds: [] })).toMatchObject({ code: 'OUT_OF_SCOPE' })
  })

  it('D1 — un propriétaire d\'analyses n\'est pas supprimé (preuves GRC)', () => {
    expect(decideUserDeletion({ ...base, ownedAnalyses: 3 })).toMatchObject({ action: 'REFUSE', status: 409, code: 'OWNS_ANALYSES' })
    expect(decideUserDeletion({ ...base, actorRole: 'SUPER_ADMIN', actorAll: true, ownedAnalyses: 3 })).toMatchObject({ code: 'OWNS_ANALYSES' })
  })

  it('un SUPER_ADMIN non focalisé supprime un compte multi-organisations sans analyse', () => {
    expect(decideUserDeletion({ ...base, actorRole: 'SUPER_ADMIN', actorAll: true, targetMembershipOrgIds: ['A', 'B'] })).toEqual({ action: 'DELETE' })
  })
})
