/** Cron des rappels d'audit (désormais fusionné dans la synthèse des relances) + configuration de l'audit interne. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ relances: vi.fn(async () => ({ checked: 3, reminded: {}, emailsSent: 2, emailsSkipped: 0 })), constats: vi.fn(), update: vi.fn(), members: vi.fn(), config: vi.fn(), send: vi.fn(), session: vi.fn(), scope: vi.fn(), upsert: vi.fn(), audit: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { auditConstat: { findMany: m.constats, update: m.update }, orgMembership: { findMany: m.members }, organizationConfig: { upsert: m.upsert } } }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config, upsertOrgConfig: (id: string, data: object) => m.upsert({ where: { id }, create: { id, ...data }, update: data }) }))
vi.mock('@/lib/email', () => ({ sendEmail: m.send }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/relances.server', () => ({ executerRelances: m.relances }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))

import { POST as CRON } from '@/app/api/cron/audit-rappels/route'
import { GET, PUT } from '@/app/api/audit/config/route'

const cron = (secret?: string) => new NextRequest('http://x/api/cron/audit-rappels', { method: 'POST', headers: secret ? { authorization: `Bearer ${secret}` } : {} })

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 's3cret-s3cret-s3cret'
  m.config.mockResolvedValue({ auditInterneActive: true, auditConfig: {} })
  m.send.mockResolvedValue({ ok: true })
  m.members.mockResolvedValue([{ user: { email: 'a@x.fr', isActive: true, locale: 'fr' } }])
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'ADMIN' })
})

describe('POST /api/cron/audit-rappels (fusionné dans la synthèse des relances)', () => {
  it('401 sans secret valide, 503 sans CRON_SECRET', async () => {
    expect((await CRON(cron('mauvais'))).status).toBe(401)
    delete process.env.CRON_SECRET
    expect((await CRON(cron('x'))).status).toBe(503)
  })
  it('exécute le passage unique des relances (un e-mail de synthèse par personne)', async () => {
    const res = await CRON(cron('s3cret-s3cret-s3cret'))
    expect(await res.json()).toMatchObject({ ok: true, fusionneDans: 'relances', emailsSent: 2 })
    expect(m.relances).toHaveBeenCalledTimes(1)
    expect(m.send).not.toHaveBeenCalled()
  })
})

describe('/api/audit/config', () => {
  it('GET : configuration effective et droit d’édition', async () => {
    const j = await (await GET()).json()
    expect(j).toMatchObject({ active: true, canEdit: true, config: { rappelJoursAvant: 14 } })
  })
  it('PUT : ADMIN uniquement, valeurs assainies, journalisé', async () => {
    const put = (b: unknown) => PUT(new NextRequest('http://x/api/audit/config', { method: 'PUT', body: JSON.stringify(b) }))
    const r = await put({ rappelJoursAvant: 999, cycles: { 4: 2 } })
    expect(r.status).toBe(200)
    expect((await r.json()).config).toMatchObject({ rappelJoursAvant: 90, cycles: { 4: 2 } })
    expect(m.audit).toHaveBeenCalled()
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'AUDITEUR' })
    expect((await put({})).status).toBe(403)
  })
})
