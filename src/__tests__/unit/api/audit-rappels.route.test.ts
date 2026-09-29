/** Cron des rappels d'audit + configuration de l'audit interne (routes, Prisma mocké). */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ constats: vi.fn(), update: vi.fn(), members: vi.fn(), config: vi.fn(), send: vi.fn(), session: vi.fn(), scope: vi.fn(), upsert: vi.fn(), audit: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { auditConstat: { findMany: m.constats, update: m.update }, orgMembership: { findMany: m.members }, organizationConfig: { upsert: m.upsert } } }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))
vi.mock('@/lib/email', () => ({ sendEmail: m.send }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))

import { POST as CRON } from '@/app/api/cron/audit-rappels/route'
import { GET, PUT } from '@/app/api/audit/config/route'

const cron = (secret?: string) => new NextRequest('http://x/api/cron/audit-rappels', { method: 'POST', headers: secret ? { authorization: `Bearer ${secret}` } : {} })
const jour = (n: number) => new Date(Date.now() + n * 86_400_000)

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 's3cret-s3cret-s3cret'
  m.config.mockResolvedValue({ auditInterneActive: true, auditConfig: {} })
  m.send.mockResolvedValue({ ok: true })
  m.members.mockResolvedValue([{ user: { email: 'a@x.fr', isActive: true, locale: 'fr' } }])
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'ADMIN' })
})

describe('POST /api/cron/audit-rappels', () => {
  it('401 sans secret valide, 503 sans CRON_SECRET', async () => {
    expect((await CRON(cron('mauvais'))).status).toBe(401)
    delete process.env.CRON_SECRET
    expect((await CRON(cron('x'))).status).toBe(503)
  })
  it('envoie les rappels dus et marque rappelLe (anti-doublon)', async () => {
    m.constats.mockResolvedValue([
      { id: 'c1', organizationId: 'o1', intitule: 'MFA', statut: 'OUVERT', echeance: jour(-2), rappelLe: null, responsableAction: 'Alice', mission: { intitule: 'Mission IAM' } },
      { id: 'c2', organizationId: 'o1', intitule: 'Logs', statut: 'OUVERT', echeance: jour(-2), rappelLe: jour(-1), responsableAction: null, mission: { intitule: 'M' } },
    ])
    const res = await CRON(cron('s3cret-s3cret-s3cret'))
    expect(await res.json()).toMatchObject({ ok: true, checked: 2, reminded: 1, emailsSent: 1 })
    expect(m.update).toHaveBeenCalledTimes(1)
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { rappelLe: expect.any(Date) } })
  })
  it('ne rappelle pas si le module ou les rappels sont désactivés pour l’organisation', async () => {
    m.constats.mockResolvedValue([{ id: 'c1', organizationId: 'o1', intitule: 'MFA', statut: 'OUVERT', echeance: jour(-2), rappelLe: null, responsableAction: null, mission: { intitule: 'M' } }])
    m.config.mockResolvedValue({ auditInterneActive: false, auditConfig: {} })
    expect((await (await CRON(cron('s3cret-s3cret-s3cret'))).json()).reminded).toBe(0)
    m.config.mockResolvedValue({ auditInterneActive: true, auditConfig: { rappelsActifs: false } })
    expect((await (await CRON(cron('s3cret-s3cret-s3cret'))).json()).reminded).toBe(0)
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
