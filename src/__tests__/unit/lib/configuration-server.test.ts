import { describe, expect, it } from 'vitest'
import { resolveEffectiveScalesScope } from '@/lib/configuration-server'

describe('resolveEffectiveScalesScope', () => {
  it('force une échelle par organisation pour une démo publique', () => {
    expect(resolveEffectiveScalesScope('SHARED', true)).toBe('PER_ORG')
  })

  it('respecte le choix d’instance hors démo', () => {
    expect(resolveEffectiveScalesScope('SHARED', false)).toBe('SHARED')
    expect(resolveEffectiveScalesScope('PER_ORG', false)).toBe('PER_ORG')
  })
})
