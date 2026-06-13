import { describe, it, expect } from 'vitest'
import { resolveSessionCookie } from '@/lib/auth-cookies'

describe('resolveSessionCookie — alignement middleware / getServerSession', () => {
  it('http → cookie NON sécurisé, comme le défaut de getToken (middleware)', () => {
    const c = resolveSessionCookie('http://localhost:3000', false)
    expect(c.name).toBe('next-auth.session-token')
    expect(c.secure).toBe(false)
  })

  it('http hors localhost → toujours NON sécurisé (sinon le cookie ne serait pas renvoyé)', () => {
    const c = resolveSessionCookie('http://acra.interne.local', false)
    expect(c.name).toBe('next-auth.session-token')
    expect(c.secure).toBe(false)
  })

  it('https → cookie sécurisé avec préfixe __Secure-', () => {
    const c = resolveSessionCookie('https://acra.example.com', false)
    expect(c.name).toBe('__Secure-next-auth.session-token')
    expect(c.secure).toBe(true)
  })

  it('URL absente + VERCEL → sécurisé (parité avec getToken)', () => {
    const c = resolveSessionCookie(undefined, true)
    expect(c.name).toBe('__Secure-next-auth.session-token')
    expect(c.secure).toBe(true)
  })

  it('URL absente sans VERCEL → non sécurisé', () => {
    const c = resolveSessionCookie(undefined, false)
    expect(c.name).toBe('next-auth.session-token')
    expect(c.secure).toBe(false)
  })

  it('URL http définie l’emporte sur VERCEL (startsWith renvoie false, pas undefined)', () => {
    const c = resolveSessionCookie('http://localhost:3000', true)
    expect(c.secure).toBe(false)
    expect(c.name).toBe('next-auth.session-token')
  })

  it('le nom et le flag secure sont toujours cohérents entre eux', () => {
    for (const url of ['http://localhost:3000', 'https://x.fr', undefined]) {
      const c = resolveSessionCookie(url, false)
      expect(c.name.startsWith('__Secure-')).toBe(c.secure)
    }
  })
})
