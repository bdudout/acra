/**
 * n° 63 : POST /api/analyses/[id]/demande-acces — un membre de l'organisation qui n'a pas
 * accès à l'analyse (règle de la liste) demande l'accès au propriétaire : e-mail dans la
 * langue du propriétaire si la messagerie est configurée, demande journalisée dans tous les cas.
 * Hors périmètre d'organisation → 404 (aucune divulgation) ; accès déjà ouvert → 400.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const db = vi.hoisted(() => ({
  analyse: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
}))
const session = vi.hoisted(() => ({ user: { id: 'dm', role: 'DIRECTION_METIER', name: 'Recette', email: 'dm@acra.test' } }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/org-context.server', () => ({
  analyseAccessWhere: vi.fn(async (_u: string, _r: string, id: string) => ({ id, OR: ['périmètre'] })),
  getEffectiveRoleForOrg: vi.fn(async () => 'DIRECTION_METIER'),
  getAnalyseScope: vi.fn(),
}))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({})) }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ allowed: true, remaining: 4, resetAt: Date.now() + 60_000 })),
  rateLimitHeaders: () => ({}),
  LIMIT_API_WRITE: { limit: 200, windowMs: 60_000 },
}))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: () => '10.0.0.3' }))
vi.mock('@/lib/email', () => ({ getSmtpSettings: vi.fn(async () => ({ host: 'smtp' })), isUsable: vi.fn(() => true), sendEmail: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/org-invitation.server', () => ({ appUrl: (p: string) => `http://localhost:3005${p}` }))

import { auditLog } from '@/lib/logger'
import { sendEmail, isUsable } from '@/lib/email'
import { POST } from '@/app/api/analyses/[id]/demande-acces/route'

const route = { params: Promise.resolve({ id: 'a1' }) }
const post = () => POST(new NextRequest('http://localhost/api/analyses/a1/demande-acces', { method: 'POST' }), route)
const analyse = (over: Record<string, unknown> = {}) => ({
  id: 'a1', nom: 'Messagerie des élus 2026', organizationId: 'orgA', userId: 'owner', statut: 'EN_COURS', deletedAt: null, accesUtilisateurs: [], ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  db.analyse.findFirst.mockResolvedValue(analyse())
  db.user.findUnique.mockResolvedValue({ id: 'owner', email: 'owner@acra.test', locale: 'en', isActive: true })
})

describe('POST /api/analyses/[id]/demande-acces', () => {
  it('cherche l\'analyse DANS le périmètre d\'organisation ; hors périmètre ou corbeille → 404', async () => {
    db.analyse.findFirst.mockResolvedValueOnce(null)
    expect((await post()).status).toBe(404)
    db.analyse.findFirst.mockResolvedValueOnce(analyse({ deletedAt: new Date() }))
    expect((await post()).status).toBe(404)
    expect(db.analyse.findFirst.mock.calls[0][0]).toMatchObject({ where: { id: 'a1', OR: ['périmètre'] } })
    expect(sendEmail).not.toHaveBeenCalled()
  })
  it('accès déjà ouvert pour ce rôle → 400 DEJA_ACCES', async () => {
    db.analyse.findFirst.mockResolvedValueOnce(analyse({ statut: 'APPROUVE' }))
    const res = await post()
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'DEJA_ACCES' })
  })
  it('e-mail au propriétaire dans sa langue + demande journalisée', async () => {
    const res = await post()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, notifie: true })
    const msg = vi.mocked(sendEmail).mock.calls[0][0]
    expect(msg.to).toBe('owner@acra.test')
    expect(msg.subject).toMatch(/access/i)
    expect(msg.text).toContain('http://localhost:3005/analyses/a1')
    expect(auditLog).toHaveBeenCalledWith('ANALYSE_ACCES_DEMANDE', expect.objectContaining({
      userId: 'dm', organizationId: 'orgA', targetId: 'a1', targetType: 'analyse', details: expect.objectContaining({ notifie: true }),
    }))
  })
  it('messagerie non configurée : demande journalisée, notifie=false', async () => {
    vi.mocked(isUsable).mockReturnValueOnce(false)
    const res = await post()
    expect(await res.json()).toEqual({ ok: true, notifie: false })
    expect(sendEmail).not.toHaveBeenCalled()
    expect(auditLog).toHaveBeenCalledWith('ANALYSE_ACCES_DEMANDE', expect.objectContaining({ details: expect.objectContaining({ notifie: false }) }))
  })
})
