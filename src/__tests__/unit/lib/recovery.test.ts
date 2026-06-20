import { describe, it, expect } from 'vitest'
import {
  RECOVERY_RETENTION_DAYS,
  purgeThreshold,
  daysRemaining,
  isExpired,
} from '@/lib/recovery'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-06-20T12:00:00Z')

describe('recovery — rétention 30 jours', () => {
  it('RECOVERY_RETENTION_DAYS = 30', () => {
    expect(RECOVERY_RETENTION_DAYS).toBe(30)
  })

  it('purgeThreshold = now − 30 jours', () => {
    expect(purgeThreshold(NOW).getTime()).toBe(NOW.getTime() - 30 * DAY)
  })

  describe('daysRemaining', () => {
    it('30 jours juste après suppression', () => {
      expect(daysRemaining(NOW, NOW)).toBe(30)
    })
    it('décroît avec le temps écoulé', () => {
      expect(daysRemaining(new Date(NOW.getTime() - 10 * DAY), NOW)).toBe(20)
      expect(daysRemaining(new Date(NOW.getTime() - 29.5 * DAY), NOW)).toBe(1)
    })
    it('0 une fois la fenêtre dépassée (jamais négatif)', () => {
      expect(daysRemaining(new Date(NOW.getTime() - 30 * DAY), NOW)).toBe(0)
      expect(daysRemaining(new Date(NOW.getTime() - 45 * DAY), NOW)).toBe(0)
    })
  })

  describe('isExpired', () => {
    it('faux dans la fenêtre, vrai au-delà de 30 jours', () => {
      expect(isExpired(new Date(NOW.getTime() - 10 * DAY), NOW)).toBe(false)
      expect(isExpired(new Date(NOW.getTime() - 29 * DAY), NOW)).toBe(false)
      expect(isExpired(new Date(NOW.getTime() - 31 * DAY), NOW)).toBe(true)
    })
    it('accepte une chaîne ISO', () => {
      expect(isExpired(new Date(NOW.getTime() - 40 * DAY).toISOString(), NOW)).toBe(true)
    })
  })
})
