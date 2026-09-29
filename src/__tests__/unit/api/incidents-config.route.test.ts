/** GET/PUT /api/incidents/config : configuration « Incidents & pertes » de l'organisation active. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), config: vi.fn(), upsert: vi.fn(), audit: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { organizationConfig: { upsert: m.upsert } } }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))

import { GET, PUT } from '@/app/api/incidents/config/route'

const put = (body: unknown) => new NextRequest('http://x/api/incidents/config', { method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'ADMIN' })
  m.config.mockResolvedValue({ incidentsActive: true, incidentsConfig: {} })
  m.upsert.mockResolvedValue({})
})

describe('GET /api/incidents/config', () => {
  it('401 sans session ; inactif quand le module est désactivé', async () => {
    m.session.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    m.session.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
    m.config.mockResolvedValue({ incidentsActive: false, incidentsConfig: {} })
    expect(await (await GET()).json()).toEqual({ active: false })
  })
  it('renvoie la configuration effective (défauts) et le droit d’édition', async () => {
    const j = await (await GET()).json()
    expect(j.active).toBe(true)
    expect(j.canEdit).toBe(true)
    expect(j.config.deviseReference).toBe('EUR')
    expect(j.config.regimes.map((r: { code: string }) => r.code)).toEqual(['NIS2', 'RGPD_33', 'INTERNE'])
  })
  it('canEdit faux pour un rôle non administrateur', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'ANALYSTE' })
    expect((await (await GET()).json()).canEdit).toBe(false)
  })
})

describe('PUT /api/incidents/config', () => {
  it('réservé à l’administrateur (403), module actif exigé', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
    expect((await PUT(put({}))).status).toBe(403)
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'ADMIN' })
    m.config.mockResolvedValue({ incidentsActive: false, incidentsConfig: {} })
    expect((await PUT(put({}))).status).toBe(403)
    expect(m.upsert).not.toHaveBeenCalled()
  })
  it('nettoie et enregistre la configuration, journalise', async () => {
    const res = await PUT(put({ deviseReference: 'usd', seuilCollecte: 1000, regimes: [{ code: 'NIS2', actif: true }, { code: 'bad code', actif: true }], junk: 1 }))
    expect(res.status).toBe(200)
    const saved = m.upsert.mock.calls[0][0].update.incidentsConfig
    expect(saved.deviseReference).toBe('USD')
    expect(saved.regimes).toEqual([{ code: 'NIS2', actif: true }])
    expect('junk' in saved).toBe(false)
    expect(m.audit).toHaveBeenCalled()
  })
})
