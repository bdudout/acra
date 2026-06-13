import { describe, it, expect } from 'vitest'
import { shouldDeactivateForInactivity, type InactivityCandidate } from '@/lib/account-lifecycle'

const NOW = new Date('2026-06-10T00:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000)

function user(over: Partial<InactivityCandidate> = {}): InactivityCandidate {
  return { id: 'u1', role: 'ANALYSTE', isActive: true, lastLoginAt: daysAgo(10), createdAt: daysAgo(400), ...over }
}

describe('shouldDeactivateForInactivity (#12)', () => {
  it('désactive un compte inactif au-delà du seuil', () => {
    expect(shouldDeactivateForInactivity(user({ lastLoginAt: daysAgo(200) }), 180, NOW)).toBe(true)
  })

  it('ne désactive pas un compte récemment connecté', () => {
    expect(shouldDeactivateForInactivity(user({ lastLoginAt: daysAgo(30) }), 180, NOW)).toBe(false)
  })

  it('exempte les ADMIN', () => {
    expect(shouldDeactivateForInactivity(user({ role: 'ADMIN', lastLoginAt: daysAgo(500) }), 180, NOW)).toBe(false)
  })

  it('désactivé si la fonctionnalité est off (0)', () => {
    expect(shouldDeactivateForInactivity(user({ lastLoginAt: daysAgo(500) }), 0, NOW)).toBe(false)
  })

  it('ignore les comptes déjà inactifs', () => {
    expect(shouldDeactivateForInactivity(user({ isActive: false, lastLoginAt: daysAgo(500) }), 180, NOW)).toBe(false)
  })

  it('utilise createdAt si jamais connecté (lastLoginAt null)', () => {
    expect(shouldDeactivateForInactivity(user({ lastLoginAt: null, createdAt: daysAgo(200) }), 180, NOW)).toBe(true)
    expect(shouldDeactivateForInactivity(user({ lastLoginAt: null, createdAt: daysAgo(30) }), 180, NOW)).toBe(false)
  })
})
