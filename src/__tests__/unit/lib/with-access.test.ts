/**
 * `withAccess` (T3 phase 2) : garde unique des routes d'écriture. L'ordre des contrôles
 * est imposé — session → rôle EFFECTIF dans l'organisation cible → permission →
 * rate limit → validation du corps — et aucun refus ne laisse le handler s'exécuter.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: vi.fn(), getEffectiveRoleForOrg: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 })),
  rateLimitHeaders: () => ({ 'Retry-After': '60' }),
  LIMIT_API_WRITE: { limit: 200, windowMs: 60_000 },
}))

import { getServerSession } from 'next-auth'
import { getAnalyseScope, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { rateLimit } from '@/lib/rate-limit'
import { withAccess, type AccessContext, type OrgTarget } from '@/lib/with-access.server'
import { isAdminRole } from '@/lib/permissions'

const json = (body: unknown, method = 'POST') =>
  new NextRequest('http://localhost/api/x', { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const noParams = { params: Promise.resolve({}) }
const okHandler = () => vi.fn(async (_req: NextRequest, _ctx: AccessContext<OrgTarget, unknown>) => new Response('ok'))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE', email: 'a@b.c', name: 'A' } } as never)
  vi.mocked(getAnalyseScope).mockResolvedValue({ role: 'ADMIN', activeOrgId: 'orgA', scope: { visibleOrgIds: ['orgA'], isSuperAdmin: false }, memberships: [] } as never)
  vi.mocked(getEffectiveRoleForOrg).mockResolvedValue('RSSI' as never)
})

describe('withAccess — session', () => {
  it('401 sans session, handler non appelé', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never)
    const handler = vi.fn()
    const res = await withAccess({ org: 'active' }, handler)(json({}), noParams)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthorized' })
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('withAccess — organisation active', () => {
  it('fournit le rôle EFFECTIF de l\'org active (pas le rôle global)', async () => {
    const handler = okHandler()
    await withAccess({ org: 'active' }, handler)(json({}), noParams)
    const ctx = handler.mock.lastCall![1]
    expect(ctx).toMatchObject({ orgId: 'orgA', role: 'ADMIN', user: { id: 'u1', role: 'ANALYSTE' } })
    expect(ctx.scope).toEqual({ visibleOrgIds: ['orgA'], isSuperAdmin: false })
  })
  it('400 sans organisation active', async () => {
    vi.mocked(getAnalyseScope).mockResolvedValue({ role: 'ANALYSTE', activeOrgId: null, scope: { visibleOrgIds: [] }, memberships: [] } as never)
    const handler = vi.fn()
    const res = await withAccess({ org: 'active' }, handler)(json({}), noParams)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'organization_required' })
    expect(handler).not.toHaveBeenCalled()
  })
  it('403 si la permission est refusée sur le rôle effectif', async () => {
    vi.mocked(getAnalyseScope).mockResolvedValue({ role: 'LECTEUR', activeOrgId: 'orgA', scope: { visibleOrgIds: ['orgA'] }, memberships: [] } as never)
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never)
    const handler = vi.fn()
    const res = await withAccess({ org: 'active', allow: isAdminRole }, handler)(json({}), noParams)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'forbidden' })
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('withAccess — organisation en paramètre', () => {
  it('résout le rôle dans l\'org du paramètre et la transmet', async () => {
    const handler = okHandler()
    await withAccess({ org: { param: 'orgId' } }, handler)(json({}), { params: Promise.resolve({ orgId: 'orgB', id: 'r1' }) })
    expect(getEffectiveRoleForOrg).toHaveBeenCalledWith('u1', 'ANALYSTE', 'orgB')
    expect(handler.mock.lastCall![1]).toMatchObject({ orgId: 'orgB', role: 'RSSI', params: { orgId: 'orgB', id: 'r1' } })
  })
  it('403 pour une organisation étrangère (aucun rôle effectif)', async () => {
    vi.mocked(getEffectiveRoleForOrg).mockResolvedValue(null as never)
    const handler = vi.fn()
    const res = await withAccess({ org: { param: 'orgId' } }, handler)(json({}), { params: Promise.resolve({ orgId: 'foreign' }) })
    expect(res.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })
  it('403 si le paramètre est absent', async () => {
    const handler = vi.fn()
    const res = await withAccess({ org: { param: 'orgId' } }, handler)(json({}), noParams)
    expect(res.status).toBe(403)
    expect(getEffectiveRoleForOrg).not.toHaveBeenCalled()
  })
})

describe('withAccess — sans organisation', () => {
  it('rôle d\'instance, orgId nul', async () => {
    const handler = okHandler()
    await withAccess({ org: 'none' }, handler)(json({}), noParams)
    expect(handler.mock.lastCall![1]).toMatchObject({ orgId: null, role: 'ANALYSTE' })
    expect(getAnalyseScope).not.toHaveBeenCalled()
  })
})

describe('withAccess — rate limit', () => {
  it('clé par seau et par utilisateur, limite d\'écriture par défaut', async () => {
    await withAccess({ org: 'active', rateLimit: { bucket: 'relances' } }, okHandler())(json({}), noParams)
    expect(rateLimit).toHaveBeenCalledWith('relances:u1', 200, 60_000)
  })
  it('429 au-delà, handler non appelé', async () => {
    vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 })
    const handler = vi.fn()
    const res = await withAccess({ org: 'active', rateLimit: { bucket: 'x' } }, handler)(json({}), noParams)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
    expect(handler).not.toHaveBeenCalled()
  })
  it('aucun compteur consommé par une requête refusée en amont', async () => {
    vi.mocked(getEffectiveRoleForOrg).mockResolvedValue(null as never)
    await withAccess({ org: { param: 'orgId' }, rateLimit: { bucket: 'x' } }, vi.fn())(json({}), { params: Promise.resolve({ orgId: 'f' }) })
    expect(rateLimit).not.toHaveBeenCalled()
  })
})

describe('withAccess — corps', () => {
  const schema = z.object({ nom: z.string().min(1), n: z.number().int().optional() })
  it('transmet le corps validé (champs inconnus retirés)', async () => {
    const handler = okHandler()
    await withAccess({ org: 'active', body: schema }, handler)(json({ nom: 'x', n: 2, isAdmin: true }), noParams)
    expect(handler.mock.lastCall![1].body).toEqual({ nom: 'x', n: 2 })
  })
  it('400 invalid_body avec les seuls chemins fautifs (pas de message interne)', async () => {
    const handler = vi.fn()
    const res = await withAccess({ org: 'active', body: schema }, handler)(json({ n: 'a' }), noParams)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_body', fields: ['nom', 'n'] })
    expect(handler).not.toHaveBeenCalled()
  })
  it('400 sur un JSON mal formé', async () => {
    const req = new NextRequest('http://localhost/api/x', { method: 'POST', body: '{oops', headers: { 'content-type': 'application/json' } })
    const res = await withAccess({ org: 'active', body: schema }, vi.fn())(req, noParams)
    expect(res.status).toBe(400)
  })
  it('sans schéma, le corps n\'est pas lu (le handler garde la main)', async () => {
    const handler = vi.fn(async (req: NextRequest) => new Response(await req.text()))
    const res = await withAccess({ org: 'active' }, handler)(json({ a: 1 }), noParams)
    expect(await res.text()).toBe('{"a":1}')
  })
})
