// Garde d'authentification MCP : (1) interrupteur d'instance `mcpEnabled` (503) ;
// (2) clé d'API valide (401) ; (3) scope `mcp` requis (403). On mocke isMcpEnabled,
// prisma.apiKey et verifyApiKey ; parseAuthorizationHeader/hasScope/apiKeyUtilisable
// restent réels.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mcpEnabled = vi.fn()
vi.mock('@/lib/interfaces-config.server', () => ({ isMcpEnabled: () => mcpEnabled() }))

const findUnique = vi.fn()
const update = vi.fn().mockResolvedValue({})
vi.mock('@/lib/prisma', () => ({
  prisma: { apiKey: { findUnique: (...a: unknown[]) => findUnique(...a), update: (...a: unknown[]) => update(...a) } },
}))

const verifyApiKey = vi.fn()
vi.mock('@/lib/api-key', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api-key')>()
  return { ...mod, verifyApiKey: (...a: unknown[]) => verifyApiKey(...a) }
})

import { authenticateMcpRequest } from '@/lib/mcp/auth.server'

const reqWith = (auth?: string) =>
  new Request('https://acra.test/api/mcp', { method: 'POST', headers: auth ? { authorization: auth } : {} })

// Accès aux champs d'échec sans se battre avec le rétrécissement de l'union.
const fail = (r: Awaited<ReturnType<typeof authenticateMcpRequest>>) => r as { ok: false; status: number; error: string }

const keyRow = (scopes: string[]) => ({
  id: 'k1', prefix: 'abc123', hashedKey: 'salt$hash', organizationId: 'orgZ', scopes,
  revokedAt: null, expiresAt: null,
})

describe('authenticateMcpRequest', () => {
  beforeEach(() => { mcpEnabled.mockReset(); findUnique.mockReset(); verifyApiKey.mockReset(); update.mockClear() })

  it('MCP désactivé → 503 sans toucher la clé', async () => {
    mcpEnabled.mockResolvedValue(false)
    const r = await authenticateMcpRequest(reqWith('Bearer acra_abc123_secret'))
    expect(r).toEqual({ ok: false, status: 503, error: 'mcp_disabled' })
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('en-tête absent/mal formé → 401', async () => {
    mcpEnabled.mockResolvedValue(true)
    expect(fail(await authenticateMcpRequest(reqWith())).status).toBe(401)
    expect(fail(await authenticateMcpRequest(reqWith('Basic xyz'))).status).toBe(401)
  })

  it('clé inconnue ou secret invalide → 401 invalid_api_key', async () => {
    mcpEnabled.mockResolvedValue(true)
    findUnique.mockResolvedValue(null)
    expect(fail(await authenticateMcpRequest(reqWith('Bearer acra_abc123_secret'))).error).toBe('invalid_api_key')

    findUnique.mockResolvedValue(keyRow(['mcp']))
    verifyApiKey.mockResolvedValue(false)
    expect(fail(await authenticateMcpRequest(reqWith('Bearer acra_abc123_secret'))).error).toBe('invalid_api_key')
  })

  it('clé valide SANS scope mcp → 403 insufficient_scope', async () => {
    mcpEnabled.mockResolvedValue(true)
    findUnique.mockResolvedValue(keyRow(['read', 'write']))
    verifyApiKey.mockResolvedValue(true)
    const r = await authenticateMcpRequest(reqWith('Bearer acra_abc123_secret'))
    expect(r).toEqual({ ok: false, status: 403, error: 'insufficient_scope' })
  })

  it('clé valide AVEC scope mcp → ok (org + keyId) et trace lastUsedAt', async () => {
    mcpEnabled.mockResolvedValue(true)
    findUnique.mockResolvedValue(keyRow(['mcp']))
    verifyApiKey.mockResolvedValue(true)
    const r = await authenticateMcpRequest(reqWith('Bearer acra_abc123_secret'))
    expect(r).toEqual({ ok: true, organizationId: 'orgZ', keyId: 'k1', scopes: ['mcp'] })
    expect(update).toHaveBeenCalledWith({ where: { id: 'k1' }, data: { lastUsedAt: expect.any(Date) } })
  })

  it('clé révoquée → 401 (avant vérification de scope)', async () => {
    mcpEnabled.mockResolvedValue(true)
    findUnique.mockResolvedValue({ ...keyRow(['mcp']), revokedAt: new Date() })
    verifyApiKey.mockResolvedValue(true)
    expect(fail(await authenticateMcpRequest(reqWith('Bearer acra_abc123_secret'))).error).toBe('api_key_revoked_or_expired')
  })
})
