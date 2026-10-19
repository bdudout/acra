/**
 * Limite de connexion par IP (2026-10-16) : elle ne compte plus que les ÉCHECS. Avant, chaque
 * tentative comptait, réussie ou non : au-delà de 50 connexions en 15 min depuis la même IP de
 * sortie (NAT d'entreprise), tous les salariés étaient refusés. Seuil réglable par l'exploitant.
 */
import { afterEach, describe, it, expect } from 'vitest'
import { configureRateLimitStore } from '@/lib/rate-limit'
import { loginIpMaxFailures, loginIpBloquee, enregistrerEchecConnexionIp } from '@/lib/login-ip-guard'

afterEach(() => configureRateLimitStore(null))

describe('loginIpMaxFailures', () => {
  it('50 par défaut ; réglable par LOGIN_IP_MAX_FAILURES (entier > 0)', () => {
    expect(loginIpMaxFailures({})).toBe(50)
    expect(loginIpMaxFailures({ LOGIN_IP_MAX_FAILURES: '500' })).toBe(500)
    expect(loginIpMaxFailures({ LOGIN_IP_MAX_FAILURES: '0' })).toBe(50)
    expect(loginIpMaxFailures({ LOGIN_IP_MAX_FAILURES: 'abc' })).toBe(50)
  })
})

describe('garde de connexion par IP', () => {
  it('des connexions réussies, aussi nombreuses soient-elles, ne bloquent pas l\'IP', async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 250)}`
    for (let i = 0; i < 200; i++) expect(await loginIpBloquee(ip, 50)).toBe(false) // 200 vérifications, aucune ne consomme
  })
  it('l\'IP est bloquée après le nombre d\'ÉCHECS autorisé', async () => {
    const ip = `198.51.100.${Math.floor(Math.random() * 250)}`
    for (let i = 0; i < 3; i++) {
      expect(await loginIpBloquee(ip, 3)).toBe(false)
      await enregistrerEchecConnexionIp(ip, 3)
    }
    expect(await loginIpBloquee(ip, 3)).toBe(true)
  })
  it('IP inconnue : jamais bloquée (pas de clé commune à tous)', async () => {
    await enregistrerEchecConnexionIp('unknown', 1); await enregistrerEchecConnexionIp('unknown', 1)
    expect(await loginIpBloquee('unknown', 1)).toBe(false)
  })
})
