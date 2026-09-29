import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), config: vi.fn(), find: vi.fn(), updateMany: vi.fn(), users: vi.fn(), audit: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { auditMission: { findFirst: m.find, updateMany: m.updateMany }, user: { findMany: m.users } } }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
import { GET, POST } from '@/app/api/audit/missions/[id]/papiers/route'

const params = { params: Promise.resolve({ id: 'm1' }) }
const post = (b: unknown) => new NextRequest('http://x/api/audit/missions/m1/papiers', { method: 'POST', body: JSON.stringify(b) })
const T = new Date('2026-09-29T10:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'a1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'AUDITEUR', scope: { isSuperAdmin: false, visibleOrgIds: ['o1'] } })
  m.config.mockResolvedValue({ auditInterneActive: true })
  m.find.mockResolvedValue({ id: 'm1', organizationId: 'o1', papiers: [], updatedAt: T })
  m.updateMany.mockResolvedValue({ count: 1 })
  m.users.mockResolvedValue([{ id: 'a1', name: 'Alice', email: 'a@x.fr' }])
})

describe('/api/audit/missions/[id]/papiers', () => {
  it('réservé à l’audit : lecture et écriture refusées à un autre rôle (403), 404 hors périmètre', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI', scope: { isSuperAdmin: false, visibleOrgIds: ['o1'] } })
    expect((await GET(new NextRequest('http://x'), params)).status).toBe(403)
    expect((await POST(post({ action: 'AJOUTER', data: { titre: 'T' } }), params)).status).toBe(403)
    m.find.mockResolvedValue(null)
    expect((await GET(new NextRequest('http://x'), params)).status).toBe(404)
  })
  it('ajoute un papier (préparateur = l’utilisateur), écriture optimiste sur updatedAt, journalisé', async () => {
    const res = await POST(post({ action: 'AJOUTER', data: { titre: 'Test des accès', travaux: 'x' } }), params)
    expect(res.status).toBe(200)
    expect(m.updateMany.mock.calls[0][0].where).toEqual({ id: 'm1', updatedAt: T })
    expect(m.updateMany.mock.calls[0][0].data.papiers[0]).toMatchObject({ titre: 'Test des accès', preparePar: 'a1', statut: 'BROUILLON' })
    expect(m.audit).toHaveBeenCalled()
  })
  it('erreurs métier en 400 avec code, action inconnue en 400, conflit en 409', async () => {
    expect(await (await POST(post({ action: 'AJOUTER', data: { titre: '' } }), params)).json()).toEqual({ error: 'titre_requis' })
    expect((await POST(post({ action: 'BOUM' }), params)).status).toBe(400)
    m.updateMany.mockResolvedValue({ count: 0 })
    expect((await POST(post({ action: 'AJOUTER', data: { titre: 'T' } }), params)).status).toBe(409)
  })
  it('GET : papiers et noms des intervenants', async () => {
    m.find.mockResolvedValue({ id: 'm1', organizationId: 'o1', updatedAt: T, papiers: [{ id: 'p1', type: 'TEST', titre: 'T', travaux: 'x', statut: 'BROUILLON', preparePar: 'a1', prepareLe: T.toISOString() }] })
    const j = await (await GET(new NextRequest('http://x'), params)).json()
    expect(j).toMatchObject({ moi: 'a1', utilisateurs: { a1: 'Alice' }, papiers: [{ id: 'p1' }] })
  })
})
