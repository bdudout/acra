/**
 * Interfaces programmatiques (API v1, MCP) — interrupteurs d'instance.
 *
 * Vérifie :
 *  1. le helper d'état `isApiEnabled` / `isMcpEnabled` (fail-closed) ;
 *  2. le GATE de l'API v1 : quand l'API est désactivée (défaut), l'authentification
 *     est refusée (503 api_disabled) AVANT toute lecture de clé/DB.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    configuration: { findUnique },
    apiKey: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

import { isApiEnabled, isMcpEnabled } from '@/lib/interfaces-config.server'

beforeEach(() => vi.clearAllMocks())

describe('isApiEnabled / isMcpEnabled — fail-closed', () => {
  it('renvoie true seulement si le toggle vaut exactement true', async () => {
    findUnique.mockResolvedValueOnce({ apiEnabled: true })
    expect(await isApiEnabled()).toBe(true)
    findUnique.mockResolvedValueOnce({ apiEnabled: false })
    expect(await isApiEnabled()).toBe(false)
    findUnique.mockResolvedValueOnce({ mcpEnabled: true })
    expect(await isMcpEnabled()).toBe(true)
  })

  it('désactivé par défaut : singleton absent ⇒ false', async () => {
    findUnique.mockResolvedValue(null)
    expect(await isApiEnabled()).toBe(false)
    expect(await isMcpEnabled()).toBe(false)
  })

  it('fail-closed : une erreur DB ⇒ désactivé', async () => {
    findUnique.mockRejectedValue(new Error('db down'))
    expect(await isApiEnabled()).toBe(false)
    expect(await isMcpEnabled()).toBe(false)
  })
})

describe('authenticateApiRequest — gate d\'instance', () => {
  const isApiEnabledMock = vi.fn()
  const apiKeyFindUnique = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    vi.doMock('@/lib/interfaces-config.server', () => ({ isApiEnabled: isApiEnabledMock, isMcpEnabled: vi.fn() }))
    vi.doMock('@/lib/prisma', () => ({ prisma: { apiKey: { findUnique: apiKeyFindUnique, update: vi.fn(() => Promise.resolve()) }, configuration: { findUnique } } }))
    vi.doMock('@/lib/api-key', () => ({
      parseAuthorizationHeader: () => ({ prefix: 'p', plaintext: 'x' }),
      verifyApiKey: async () => true,
      apiKeyUtilisable: () => true,
      hasScope: () => true,
    }))
    isApiEnabledMock.mockReset()
    apiKeyFindUnique.mockReset()
  })

  it('API désactivée ⇒ 503 api_disabled, sans lire la clé en base', async () => {
    isApiEnabledMock.mockResolvedValue(false)
    const { authenticateApiRequest } = await import('@/lib/api-auth.server')
    const res = await authenticateApiRequest(new Request('http://x', { headers: { authorization: 'Bearer p.x' } }))
    expect(res).toMatchObject({ ok: false, status: 503, error: 'api_disabled' })
    expect(apiKeyFindUnique).not.toHaveBeenCalled() // aucun accès DB à la clé
  })

  it('API activée + clé valide + scope ⇒ ok', async () => {
    isApiEnabledMock.mockResolvedValue(true)
    apiKeyFindUnique.mockResolvedValue({ id: 'k', prefix: 'p', hashedKey: 'h', scopes: ['read', 'write'], organizationId: 'org1' })
    const { authenticateApiRequest } = await import('@/lib/api-auth.server')
    const res = await authenticateApiRequest(new Request('http://x', { headers: { authorization: 'Bearer p.x' } }))
    expect(res).toMatchObject({ ok: true, organizationId: 'org1', keyId: 'k' })
  })
})
