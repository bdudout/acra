import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ orgs: vi.fn(), editions: vi.fn(), create: vi.fn(), admin: vi.fn(), config: vi.fn(), gen: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { organizationConfig: { findMany: m.orgs }, rapportEdition: { findMany: m.editions, create: m.create }, orgMembership: { findFirst: m.admin } } }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))
vi.mock('@/lib/rapports.server', () => ({ genererContenuRapport: m.gen }))
import { POST } from '@/app/api/cron/rapports-planifies/route'

const req = (secret = 's3cret-s3cret-s3cret') => new NextRequest('http://x/api/cron/rapports-planifies', { method: 'POST', headers: { authorization: `Bearer ${secret}` } })

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 's3cret-s3cret-s3cret'
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-02T05:00:00Z'))
  m.orgs.mockResolvedValue([{ id: 'o1', rapportsConfig: { planifies: [{ code: 'R-INC-1', frequence: 'MENSUEL' }] } }, { id: 'o2', rapportsConfig: {} }])
  m.config.mockResolvedValue({ incidentsActive: true })
  m.editions.mockResolvedValue([])
  m.admin.mockResolvedValue({ userId: 'admin1' })
  m.gen.mockResolvedValue({ sections: [] })
})

describe('POST /api/cron/rapports-planifies', () => {
  it('401 sans secret valide', async () => { expect((await POST(req('mauvais'))).status).toBe(401); vi.useRealTimers() })
  it('génère le brouillon de la période précédente, créé par un ADMIN', async () => {
    const j = await (await POST(req())).json()
    vi.useRealTimers()
    expect(j).toEqual({ ok: true, orgs: 1, created: 1 })
    expect(m.create.mock.calls[0][0].data).toMatchObject({ organizationId: 'o1', code: 'R-INC-1', statut: 'BROUILLON', createdById: 'admin1', periodeDebut: new Date('2026-09-01T00:00:00Z'), periodeFin: new Date('2026-09-30T00:00:00Z') })
  })
  it('idempotent : édition déjà présente, ou module inactif, ou sans ADMIN → rien', async () => {
    m.editions.mockResolvedValue([{ code: 'R-INC-1', periodeDebut: new Date('2026-09-01'), periodeFin: new Date('2026-09-30') }])
    expect((await (await POST(req())).json()).created).toBe(0)
    m.editions.mockResolvedValue([]); m.config.mockResolvedValue({ incidentsActive: false })
    expect((await (await POST(req())).json()).created).toBe(0)
    m.config.mockResolvedValue({ incidentsActive: true }); m.admin.mockResolvedValue(null)
    expect((await (await POST(req())).json()).created).toBe(0)
    vi.useRealTimers()
    expect(m.create).not.toHaveBeenCalled()
  })
})
