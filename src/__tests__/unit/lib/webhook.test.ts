import { describe, it, expect } from 'vitest'
import {
  WEBHOOK_EVENTS,
  cleanWebhookEvents,
  signWebhookPayload,
  webhookSubscribers,
  nextBackoffDelayMs,
  isSafeWebhookUrl,
  resolveDeliveryUpdate,
  WEBHOOK_MAX_ATTEMPTS,
} from '@/lib/webhook'

describe('cleanWebhookEvents', () => {
  it('ne garde que des événements connus, dédupliqués', () => {
    const r = cleanWebhookEvents(['risk.created', 'risk.created', 'inconnu', 'incident.declared'])
    expect(r).toEqual(['risk.created', 'incident.declared'])
  })
  it("'*' abonne à tous les événements", () => {
    expect(cleanWebhookEvents(['*'])).toEqual([...WEBHOOK_EVENTS])
  })
  it('entrée non-tableau → []', () => {
    expect(cleanWebhookEvents('risk.created' as unknown)).toEqual([])
  })
})

describe('signWebhookPayload', () => {
  it('HMAC-SHA256 hex déterministe, dépend du secret et du corps', () => {
    const a = signWebhookPayload('s1', '{"x":1}')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(signWebhookPayload('s1', '{"x":1}')).toBe(a)
    expect(signWebhookPayload('s2', '{"x":1}')).not.toBe(a)
    expect(signWebhookPayload('s1', '{"x":2}')).not.toBe(a)
  })
})

describe('webhookSubscribers', () => {
  const hooks = [
    { id: 'a', actif: true, events: ['risk.created'] },
    { id: 'b', actif: true, events: ['incident.declared'] },
    { id: 'c', actif: false, events: ['risk.created'] },
    { id: 'd', actif: true, events: ['*'] },
  ]
  it('sélectionne les abonnés actifs pour l’événement (dont *)', () => {
    expect(webhookSubscribers(hooks, 'risk.created').map(h => h.id)).toEqual(['a', 'd'])
  })
  it('exclut les inactifs et les non-abonnés', () => {
    expect(webhookSubscribers(hooks, 'control.anomaly').map(h => h.id)).toEqual(['d'])
  })
})

describe('nextBackoffDelayMs', () => {
  it('croît exponentiellement et plafonne', () => {
    const d1 = nextBackoffDelayMs(1)
    const d2 = nextBackoffDelayMs(2)
    const d3 = nextBackoffDelayMs(3)
    expect(d2).toBeGreaterThan(d1)
    expect(d3).toBeGreaterThan(d2)
    expect(nextBackoffDelayMs(99)).toBeLessThanOrEqual(nextBackoffDelayMs(100))
    expect(nextBackoffDelayMs(100)).toBeLessThanOrEqual(6 * 60 * 60 * 1000) // cap 6h
  })
})

describe('isSafeWebhookUrl (garde SSRF)', () => {
  it('accepte une URL https publique', () => {
    expect(isSafeWebhookUrl('https://hooks.example.com/acra')).toBe(true)
  })
  it('refuse http (non chiffré)', () => {
    expect(isSafeWebhookUrl('http://hooks.example.com/acra')).toBe(false)
  })
  it('refuse loopback / privé / link-local / metadata', () => {
    expect(isSafeWebhookUrl('https://localhost/x')).toBe(false)
    expect(isSafeWebhookUrl('https://127.0.0.1/x')).toBe(false)
    expect(isSafeWebhookUrl('https://10.0.0.5/x')).toBe(false)
    expect(isSafeWebhookUrl('https://192.168.1.10/x')).toBe(false)
    expect(isSafeWebhookUrl('https://172.16.0.1/x')).toBe(false)
    expect(isSafeWebhookUrl('https://169.254.169.254/latest/meta-data')).toBe(false)
    expect(isSafeWebhookUrl('https://[::1]/x')).toBe(false)
  })
  it('refuse un schéma non http(s) et une entrée invalide', () => {
    expect(isSafeWebhookUrl('ftp://example.com')).toBe(false)
    expect(isSafeWebhookUrl('pas une url')).toBe(false)
    expect(isSafeWebhookUrl('')).toBe(false)
  })
})

describe('resolveDeliveryUpdate', () => {
  it('succès → LIVRE, sans ré-essai', () => {
    const u = resolveDeliveryUpdate(0, { ok: true, code: 200 })
    expect(u.statut).toBe('LIVRE')
    expect(u.tentatives).toBe(1)
    expect(u.prochaineTentativeDelayMs).toBe(0)
    expect(u.derniereErreur).toBeNull()
  })
  it('échec avant plafond → EN_ATTENTE avec backoff', () => {
    const u = resolveDeliveryUpdate(1, { ok: false, code: 503 })
    expect(u.statut).toBe('EN_ATTENTE')
    expect(u.tentatives).toBe(2)
    expect(u.prochaineTentativeDelayMs).toBeGreaterThan(0)
    expect(u.dernierCode).toBe(503)
    expect(u.derniereErreur).toContain('503')
  })
  it('échec à la dernière tentative → ECHEC (abandon)', () => {
    const u = resolveDeliveryUpdate(WEBHOOK_MAX_ATTEMPTS - 1, { ok: false, error: 'timeout' })
    expect(u.statut).toBe('ECHEC')
    expect(u.tentatives).toBe(WEBHOOK_MAX_ATTEMPTS)
    expect(u.prochaineTentativeDelayMs).toBe(0)
  })
})

describe('WEBHOOK_MAX_ATTEMPTS', () => {
  it('borne le nombre de tentatives', () => {
    expect(WEBHOOK_MAX_ATTEMPTS).toBeGreaterThanOrEqual(3)
  })
})
