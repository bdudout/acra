// GET /api/mcp-activity : réservé à l'administrateur de l'organisation active ; tout est borné à cette organisation.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const role = vi.hoisted(() => ({ value: 'ADMIN' as string }))
const m = vi.hoisted(() => ({ keys: vi.fn(), audit: vi.fn(), props: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: vi.fn(async () => ({ role: role.value, activeOrgId: 'orgA' })) }))
vi.mock('@/lib/interfaces-config.server', () => ({ isMcpEnabled: vi.fn(async () => true) }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ mcpActive: true })) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    apiKey: { findMany: (...a: unknown[]) => m.keys(...a) },
    auditLog: { findMany: (...a: unknown[]) => m.audit(...a) },
    mcpProposal: { findMany: (...a: unknown[]) => m.props(...a) },
  },
}))
import { GET } from '@/app/api/mcp-activity/route'

beforeEach(() => {
  role.value = 'ADMIN'; Object.values(m).forEach(f => f.mockReset())
  m.keys.mockResolvedValue([{ id: 'k1', name: 'Claude', prefix: 'abc', scopes: ['read', 'mcp'], createdAt: new Date(), lastUsedAt: null, expiresAt: null, revokedAt: null }])
  m.audit.mockResolvedValue([{ details: '{"keyId":"k1","tool":"read_projet","ok":true}', createdAt: new Date() }])
  m.props.mockResolvedValue([{ apiKeyId: 'k1', statut: 'EN_ATTENTE' }])
})

describe('GET /api/mcp-activity', () => {
  it('administrateur : synthèse bornée à l’organisation active, état des interrupteurs', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ instanceActive: true, orgActive: true, totaux: { clesActives: 1, appels: 1, enAttente: 1 } })
    expect(m.keys.mock.calls[0][0].where).toEqual({ organizationId: 'orgA' })
    expect(m.audit.mock.calls[0][0].where).toMatchObject({ organizationId: 'orgA', action: 'MCP_TOOL_INVOKED' })
    expect(m.props.mock.calls[0][0].where).toEqual({ organizationId: 'orgA' })
  })
  it('autre rôle (RSSI) → 403, rien n’est lu', async () => {
    role.value = 'RSSI'
    expect((await GET()).status).toBe(403)
    expect(m.keys).not.toHaveBeenCalled()
  })
})
