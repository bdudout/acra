// @vitest-environment node
// Points d'accès d'un usage TIC : création, remplacement, suppression ; isolation par organisation ; journalisé.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ ctx: vi.fn(), usage: vi.fn(), count: vi.fn(), create: vi.fn(), point: vi.fn(), update: vi.fn(), del: vi.fn(), audit: vi.fn() }))
vi.mock('@/lib/tier-registry.server', () => ({ tierContext: m.ctx }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  tierServiceUsage: { findUnique: m.usage },
  tierUsageEndpoint: { count: m.count, create: m.create, findUnique: m.point, update: m.update, delete: m.del },
} }))
import { POST } from '@/app/api/tier-registry/usages/[usageId]/points-acces/route'
import { PUT, DELETE } from '@/app/api/tier-registry/usages/[usageId]/points-acces/[pointId]/route'

const req = (method: string, body?: object) => new NextRequest('http://x/api', { method, ...(body ? { body: JSON.stringify(body) } : {}) })
const pUsage = { params: Promise.resolve({ usageId: 'u1' }) }
const pPoint = { params: Promise.resolve({ usageId: 'u1', pointId: 'pa1' }) }
beforeEach(() => {
  vi.clearAllMocks()
  m.ctx.mockResolvedValue({ ctx: { orgId: 'org1', userId: 'u', role: 'ADMIN' } })
  m.usage.mockResolvedValue({ id: 'u1', organizationId: 'org1' })
  m.count.mockResolvedValue(0)
  m.create.mockImplementation(async ({ data }) => ({ id: 'pa1', ...data }))
  m.point.mockResolvedValue({ id: 'pa1', usageId: 'u1', organizationId: 'org1' })
  m.update.mockImplementation(async ({ data }) => ({ id: 'pa1', ...data }))
})

describe('POST points d’accès', () => {
  it('crée le point (hôte normalisé, organisation de l’usage) et journalise', async () => {
    const res = await POST(req('POST', { adresse: 'https://API.psp.example/v2', type: 'API', environnement: 'PRODUCTION', authentification: 'CERTIFICAT' }), pUsage)
    expect(res.status).toBe(201)
    expect(m.create).toHaveBeenCalledWith({ data: expect.objectContaining({ usageId: 'u1', organizationId: 'org1', adresse: 'https://api.psp.example/v2', hote: 'api.psp.example', type: 'API' }) })
    expect(m.audit).toHaveBeenCalled()
  })
  it('identifiants dans l’URL : 400, rien écrit', async () => {
    const res = await POST(req('POST', { adresse: 'https://a:b@x.example', type: 'WEB' }), pUsage)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'identifiants_interdits' })
    expect(m.create).not.toHaveBeenCalled()
  })
  it('usage d’une autre organisation : 404, rien écrit', async () => {
    m.usage.mockResolvedValue({ id: 'u1', organizationId: 'autre' })
    expect((await POST(req('POST', { adresse: 'x.example', type: 'WEB' }), pUsage)).status).toBe(404)
    expect(m.create).not.toHaveBeenCalled()
  })
  it('plafond de points par usage : 409', async () => {
    m.count.mockResolvedValue(50)
    expect((await POST(req('POST', { adresse: 'x.example', type: 'WEB' }), pUsage)).status).toBe(409)
  })
  it('droits insuffisants : réponse du contexte renvoyée', async () => {
    m.ctx.mockResolvedValue({ error: new Response(null, { status: 403 }) })
    expect((await POST(req('POST', { adresse: 'x.example', type: 'WEB' }), pUsage)).status).toBe(403)
  })
})

describe('PUT / DELETE point d’accès', () => {
  it('remplace le point de l’usage', async () => {
    const res = await PUT(req('PUT', { adresse: 'sftp.partenaire.fr', type: 'SFTP' }), pPoint)
    expect(res.status).toBe(200)
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'pa1' }, data: expect.objectContaining({ adresse: 'sftp.partenaire.fr', hote: 'sftp.partenaire.fr', type: 'SFTP' }) })
  })
  it('point d’un autre usage ou d’une autre organisation : 404', async () => {
    m.point.mockResolvedValue({ id: 'pa1', usageId: 'u2', organizationId: 'org1' })
    expect((await PUT(req('PUT', { adresse: 'x.example', type: 'WEB' }), pPoint)).status).toBe(404)
    m.point.mockResolvedValue({ id: 'pa1', usageId: 'u1', organizationId: 'autre' })
    expect((await DELETE(req('DELETE'), pPoint)).status).toBe(404)
    expect(m.update).not.toHaveBeenCalled(); expect(m.del).not.toHaveBeenCalled()
  })
  it('supprime et journalise', async () => {
    expect((await DELETE(req('DELETE'), pPoint)).status).toBe(200)
    expect(m.del).toHaveBeenCalledWith({ where: { id: 'pa1' } })
    expect(m.audit).toHaveBeenCalled()
  })
})
