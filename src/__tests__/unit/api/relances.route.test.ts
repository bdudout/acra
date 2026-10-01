/** Cron des relances (authentification) + paramétrage des relances (droits ADMIN, assainissement). */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), config: vi.fn(), upsert: vi.fn(), audit: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { organizationConfig: { upsert: m.upsert } } }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))

import { POST as CRON } from '@/app/api/cron/relances/route'
import { GET, PUT } from '@/app/api/relances/config/route'

const put = (body: unknown) => new NextRequest('http://x/api/relances/config', { method: 'PUT', body: JSON.stringify(body) })

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'ADMIN' })
  m.config.mockResolvedValue({ relancesConfig: {} })
})

describe('POST /api/cron/relances', () => {
  it('401 sans secret valide, 503 sans CRON_SECRET', async () => {
    process.env.CRON_SECRET = 's3cret-s3cret-s3cret'
    expect((await CRON(new NextRequest('http://x', { method: 'POST', headers: { authorization: 'Bearer non' } }))).status).toBe(401)
    delete process.env.CRON_SECRET
    expect((await CRON(new NextRequest('http://x', { method: 'POST' }))).status).toBe(503)
  })
})

describe('/api/relances/config', () => {
  it('GET : défauts (mensuel) et droit d’édition selon le rôle effectif', async () => {
    expect(await (await GET()).json()).toEqual({ canEdit: true, config: { actives: true, joursAvant: 14, periodiciteJours: 30, attenteJours: 7, tableauBordMensuel: true } })
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RISK_MANAGER' })
    expect((await (await GET()).json()).canEdit).toBe(false)
  })
  it('PUT : réservé à l’ADMIN de l’organisation, valeurs bornées, journalisé', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RISK_MANAGER' })
    expect((await PUT(put({ actives: false }))).status).toBe(403)
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'ADMIN' })
    const res = await PUT(put({ actives: false, joursAvant: 365, periodiciteJours: 0 }))
    expect((await res.json()).config).toEqual({ actives: false, joursAvant: 90, periodiciteJours: 0, attenteJours: 7, tableauBordMensuel: true })
    expect(m.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'o1' }, update: { relancesConfig: { actives: false, joursAvant: 90, periodiciteJours: 0, attenteJours: 7, tableauBordMensuel: true } } }))
    expect(m.audit).toHaveBeenCalledTimes(1)
  })
})
