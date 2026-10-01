import { describe, expect, it } from 'vitest'
import { resolveIsAdmin } from '@/lib/effective-admin'

describe('resolveIsAdmin — le rôle effectif dans l’organisation active prime sur le rôle de session', () => {
  it('ADMIN de l’organisation avec un rôle global « analyste » : administrateur', () => expect(resolveIsAdmin('ANALYSTE', 'ADMIN')).toBe(true))
  it('rôle global ADMIN mais simple analyste dans l’organisation active : pas administrateur', () => expect(resolveIsAdmin('ADMIN', 'ANALYSTE')).toBe(false))
  it('super-administrateur : administrateur', () => expect(resolveIsAdmin('ANALYSTE', 'SUPER_ADMIN')).toBe(true))
  it('rôle effectif pas encore connu : repli sur le rôle de session (les API restent le garde-fou)', () => {
    expect(resolveIsAdmin('ADMIN', undefined)).toBe(true); expect(resolveIsAdmin('ANALYSTE', undefined)).toBe(false); expect(resolveIsAdmin(undefined, undefined)).toBe(false)
  })
  it('aucune appartenance (rôle effectif nul) : pas administrateur', () => expect(resolveIsAdmin('ADMIN', null)).toBe(false))
})
