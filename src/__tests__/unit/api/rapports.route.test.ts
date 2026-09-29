/** /api/rapports : liste, génération d'une édition (brouillon), droits, modules. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), config: vi.fn(), find: vi.fn(), create: vi.fn(), gen: vi.fn(), audit: vi.fn(), rl: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { rapportEdition: { findMany: m.find, create: m.create } } }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))
vi.mock('@/lib/rapports.server', () => ({ genererContenuRapport: m.gen }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rl, LIMIT_API_WRITE: { limit: 30, windowMs: 60000 } }))

import { GET, POST } from '@/app/api/rapports/route'

const post = (body: unknown) => new NextRequest('http://x/api/rapports', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
  m.config.mockResolvedValue({ incidentsActive: true, registreRisquesActive: false })
  m.find.mockResolvedValue([{ id: 'e1', code: 'R-INC-1', statut: 'BROUILLON', periodeDebut: new Date('2026-09-01'), periodeFin: new Date('2026-09-30'), createdAt: new Date('2026-10-01') }])
  m.gen.mockResolvedValue({ code: 'R-INC-1', periode: { debut: '2026-09-01', fin: '2026-09-30' }, sections: [] })
  m.create.mockImplementation(async (a: { data: unknown }) => ({ id: 'e2', ...(a.data as object) }))
  m.rl.mockResolvedValue({ allowed: true, remaining: 10, resetAt: 0 })
})

describe('GET /api/rapports', () => {
  it('401 sans session ; 403 pour un rôle sans lecture globale', async () => {
    m.session.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'LECTEUR' })
    expect((await GET()).status).toBe(403)
  })
  it('renvoie les éditions, les rapports disponibles selon les modules et le droit d’écriture', async () => {
    const j = await (await GET()).json()
    expect(j.editions).toHaveLength(1)
    expect(j.disponibles.map((r: { code: string }) => r.code)).toEqual(['R-INC-1', 'R-INC-2', 'R-PER-2'])
    expect(j.canWrite).toBe(true)
    expect(m.find.mock.calls[0][0].where).toEqual({ organizationId: 'o1' })
  })
})

describe('POST /api/rapports', () => {
  it('génère un brouillon figé avec la période et la langue, journalise', async () => {
    const res = await POST(post({ code: 'R-INC-1', periode: { debut: '2026-09-01', fin: '2026-09-30' }, langue: 'en' }))
    expect(res.status).toBe(201)
    const data = m.create.mock.calls[0][0].data
    expect(data).toMatchObject({ organizationId: 'o1', code: 'R-INC-1', statut: 'BROUILLON', langue: 'en', createdById: 'u1' })
    expect(m.gen).toHaveBeenCalledWith('R-INC-1', 'o1', expect.anything(), { debut: '2026-09-01', fin: '2026-09-30' }, 'en', expect.any(Date))
    expect(m.audit).toHaveBeenCalled()
  })
  it('refuse : rôle sans écriture (403), rapport indisponible (400), période invalide (400)', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'DIRECTION_METIER' })
    expect((await POST(post({ code: 'R-INC-1', periode: { debut: '2026-09-01', fin: '2026-09-30' } }))).status).toBe(403)
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
    expect((await POST(post({ code: 'R-GRC-3', periode: { debut: '2026-09-01', fin: '2026-09-30' } }))).status).toBe(400) // aucun module GRC actif
    expect((await POST(post({ code: 'R-INC-1', periode: { debut: '2026-10-01', fin: '2026-09-30' } }))).status).toBe(400)
    expect((await POST(post({ code: 'R-XXX', periode: { debut: '2026-09-01', fin: '2026-09-30' } }))).status).toBe(400)
    expect(m.create).not.toHaveBeenCalled()
  })
  it('limite de débit (429)', async () => {
    m.rl.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0 })
    expect((await POST(post({ code: 'R-INC-1', periode: { debut: '2026-09-01', fin: '2026-09-30' } }))).status).toBe(429)
  })
})
