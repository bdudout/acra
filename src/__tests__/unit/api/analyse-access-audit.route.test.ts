/**
 * Accès granulaires à une analyse : la permission accordée est validée (400, plus d'erreur 500
 * sur une valeur hors énumération) et chaque octroi ou retrait est journalisé (ACCESS_GRANTED /
 * ACCESS_REVOKED, organisation de l'analyse).
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const db = vi.hoisted(() => ({
  analyse: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
  analyseAcces: { upsert: vi.fn(), deleteMany: vi.fn() },
}))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'owner', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/org-context.server', () => ({
  analyseAccessWhere: vi.fn(async (_u: string, _r: string, id: string) => ({ id })),
  getEffectiveRoleForOrg: vi.fn(async () => 'ADMIN'),
}))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ gelApresAcceptationActive: false })) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: () => '10.0.0.2' }))

import { auditLog } from '@/lib/logger'
import { POST, DELETE } from '@/app/api/analyses/[id]/access/route'

const route = { params: Promise.resolve({ id: 'an1' }) }
const post = (body: unknown) => POST(new NextRequest('http://localhost/api/analyses/an1/access', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), route)

beforeEach(() => {
  vi.clearAllMocks()
  db.analyse.findFirst.mockResolvedValue({ id: 'an1', organizationId: 'orgA', userId: 'owner', statut: 'BROUILLON', methode: 'EBIOS_RM', risquesResiduelsStatut: null, deletedAt: null, accesUtilisateurs: [] })
  db.user.findUnique.mockResolvedValue({ id: 'invite' })
  db.analyseAcces.upsert.mockResolvedValue({ id: 'acc1', permission: 'EDITION' })
  db.analyseAcces.deleteMany.mockResolvedValue({ count: 1 })
})

describe('POST /api/analyses/[id]/access', () => {
  it('permission hors énumération → 400, rien n\'est écrit', async () => {
    const res = await post({ email: 'x@y.fr', permission: 'PROPRIETAIRE' })
    expect(res.status).toBe(400)
    expect(db.analyseAcces.upsert).not.toHaveBeenCalled()
  })
  it('octroi journalisé (ACCESS_GRANTED, organisation de l\'analyse, permission)', async () => {
    const res = await post({ email: 'x@y.fr', permission: 'EDITION' })
    expect(res.status).toBe(201)
    expect(auditLog).toHaveBeenCalledWith('ACCESS_GRANTED', expect.objectContaining({
      userId: 'owner', organizationId: 'orgA', targetId: 'an1', targetType: 'analyse',
      details: expect.objectContaining({ beneficiaireId: 'invite', permission: 'EDITION' }),
    }))
  })
})

describe('DELETE /api/analyses/[id]/access', () => {
  it('retrait journalisé (ACCESS_REVOKED)', async () => {
    const res = await DELETE(new NextRequest('http://localhost/api/analyses/an1/access?targetUserId=invite', { method: 'DELETE' }), route)
    expect(res.status).toBe(200)
    expect(auditLog).toHaveBeenCalledWith('ACCESS_REVOKED', expect.objectContaining({ organizationId: 'orgA', targetId: 'an1', details: expect.objectContaining({ beneficiaireId: 'invite' }) }))
  })
})
