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

import { decideUserManagement } from '@/lib/user-deletion'

// Audit 2026-10-01 (T1) : rôle global, suspension et réinitialisation du mot de passe.
describe('decideUserManagement', () => {
  const m = { actorRole: 'ADMIN', actorAll: false, actorVisibleOrgIds: ['A'], targetRole: 'ANALYSTE', targetMembershipOrgIds: ['A'] }

  it('autorise un compte entièrement dans le périmètre', () => {
    expect(decideUserManagement(m)).toEqual({ allowed: true })
  })
  it('un ADMIN ne gère jamais un SUPER_ADMIN (reset-password renvoyait le mot de passe temporaire → prise de contrôle)', () => {
    expect(decideUserManagement({ ...m, targetRole: 'SUPER_ADMIN' })).toMatchObject({ allowed: false, code: 'SUPER_ADMIN_ONLY' })
    expect(decideUserManagement({ ...m, actorAll: true, targetRole: 'SUPER_ADMIN' })).toMatchObject({ allowed: false, code: 'SUPER_ADMIN_ONLY' })
  })
  it('refuse un compte partagé avec une organisation hors périmètre', () => {
    expect(decideUserManagement({ ...m, targetMembershipOrgIds: ['A', 'B'] })).toMatchObject({ allowed: false, code: 'SHARED_ACCOUNT' })
  })
  it('refuse un compte hors périmètre', () => {
    expect(decideUserManagement({ ...m, targetMembershipOrgIds: ['B'] })).toMatchObject({ allowed: false, code: 'OUT_OF_SCOPE' })
  })
  it('un SUPER_ADMIN non focalisé gère tout compte, y compris un autre SUPER_ADMIN', () => {
    expect(decideUserManagement({ ...m, actorRole: 'SUPER_ADMIN', actorAll: true, targetRole: 'SUPER_ADMIN', targetMembershipOrgIds: ['A', 'B'] })).toEqual({ allowed: true })
  })
})

import { planAnalysesReassignment } from '@/lib/user-deletion'

describe('planAnalysesReassignment (T2)', () => {
  const base = { actorAll: false, actorVisibleOrgIds: ['A'], recipientAll: false, recipientOrgIds: ['A'] }
  it('transfère les analyses du périmètre accessibles au destinataire', () => {
    expect(planAnalysesReassignment({ ...base, analyses: [{ id: '1', organizationId: 'A' }, { id: '2', organizationId: 'A' }] }))
      .toEqual({ transfer: ['1', '2'], outOfActorScope: 0, recipientNoAccess: 0 })
  })
  it('ne touche pas aux analyses hors du périmètre de l\'administrateur', () => {
    expect(planAnalysesReassignment({ ...base, analyses: [{ id: '1', organizationId: 'B' }] })).toMatchObject({ transfer: [], outOfActorScope: 1 })
  })
  it('ne donne pas au destinataire une analyse qu\'il ne pourrait pas ouvrir', () => {
    expect(planAnalysesReassignment({ ...base, actorVisibleOrgIds: ['A', 'C'], analyses: [{ id: '1', organizationId: 'C' }] }))
      .toMatchObject({ transfer: [], recipientNoAccess: 1 })
  })
  it('analyse sans organisation : seulement par un SUPER_ADMIN global', () => {
    expect(planAnalysesReassignment({ ...base, analyses: [{ id: '1', organizationId: null }] })).toMatchObject({ outOfActorScope: 1 })
    expect(planAnalysesReassignment({ ...base, actorAll: true, recipientAll: true, analyses: [{ id: '1', organizationId: null }] })).toMatchObject({ transfer: ['1'] })
  })
})
