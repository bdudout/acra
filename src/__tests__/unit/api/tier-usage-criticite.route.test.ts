// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ ctx: vi.fn(), find: vi.fn(), update: vi.fn(), audit: vi.fn() }))
vi.mock('@/lib/tier-registry.server', () => ({ tierContext: m.ctx }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/prisma', () => ({ prisma: { tierServiceUsage: { findUnique: m.find, update: m.update, delete: vi.fn() } } }))
import { PATCH } from '@/app/api/tier-registry/usages/[usageId]/route'

const call = (body: object) => PATCH(new NextRequest('http://x/api/tier-registry/usages/u1', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ usageId: 'u1' }) })
beforeEach(() => {
  vi.clearAllMocks()
  m.ctx.mockResolvedValue({ ctx: { orgId: 'org1', userId: 'u', role: 'ADMIN' } })
  m.find.mockResolvedValue({ id: 'u1', organizationId: 'org1' })
})

describe('PATCH usage — criticité', () => {
  it('qualifie l’usage de l’organisation active et journalise', async () => {
    const res = await call({ criticite: 'CRITIQUE' })
    expect(res.status).toBe(200)
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { criticite: 'CRITIQUE' } })
    expect(m.audit).toHaveBeenCalled()
  })
  it('vide = non renseignée', async () => {
    await call({ criticite: '' })
    expect(m.update.mock.calls[0][0].data).toEqual({ criticite: null })
  })
  it('valeur inconnue : 400, rien écrit', async () => {
    expect((await call({ criticite: 'urgent' })).status).toBe(400)
    expect(m.update).not.toHaveBeenCalled()
  })
  it('usage d’une autre organisation : 404 sans divulgation, rien écrit', async () => {
    m.find.mockResolvedValue({ id: 'u1', organizationId: 'orgAutre' })
    expect((await call({ criticite: 'CRITIQUE' })).status).toBe(404)
    expect(m.update).not.toHaveBeenCalled()
  })
  it('droits insuffisants (contexte refusé) : la réponse d’erreur est renvoyée telle quelle', async () => {
    m.ctx.mockResolvedValue({ error: new Response(null, { status: 403 }) })
    expect((await call({ criticite: 'CRITIQUE' })).status).toBe(403)
    expect(m.update).not.toHaveBeenCalled()
  })
})
