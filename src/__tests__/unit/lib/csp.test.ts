import { describe, it, expect } from 'vitest'
import { buildCsp } from '../../../lib/csp'

describe('buildCsp — durcissement CSP (issue #108)', () => {
  it('production + nonce : script-src à nonce + strict-dynamic, PAS d\'unsafe-inline', () => {
    const csp = buildCsp('abc123', true)
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'")
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'")
  })
  it('dev : script-src garde unsafe-inline (HMR), pas de nonce', () => {
    const csp = buildCsp(undefined, false)
    expect(csp).toContain("script-src 'self' 'unsafe-inline'")
    expect(csp).not.toContain('nonce-')
    expect(csp).not.toContain('strict-dynamic')
  })
  it('production sans nonce (repli défensif) : pas de script-src cassé', () => {
    const csp = buildCsp(undefined, true)
    expect(csp).toContain("script-src 'self' 'unsafe-inline'")
  })
  it('conserve les directives de durcissement communes', () => {
    const csp = buildCsp('n', true)
    for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "style-src 'self' 'unsafe-inline'"]) {
      expect(csp).toContain(d)
    }
  })
})
