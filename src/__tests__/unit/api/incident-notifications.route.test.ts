/** POST/DELETE /api/incidents/[id]/notifications : marquer une phase de notification comme soumise. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), load: vi.fn(), update: vi.fn(), audit: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { incident: { update: m.update } } }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/incident-access.server', async () => {
  const actual = await vi.importActual<typeof import('@/lib/incident-access.server')>('@/lib/incident-access.server').catch(() => null)
  return { loadIncidentInScope: m.load, peutQualifier: (role: string) => ['RISK_MANAGER', 'RSSI', 'ADMIN'].includes(role) || !actual }
})

import { POST, DELETE } from '@/app/api/incidents/[id]/notifications/route'

const params = { params: Promise.resolve({ id: 'i1' }) }
const req = (body: unknown, method = 'POST') => new NextRequest('http://x/api/incidents/i1/notifications', { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const ctx = (role = 'RSSI', notifications: unknown[] = []) => ({
  userId: 'u1', userRole: role, secondeLigneActive: true,
  incident: { id: 'i1', organizationId: 'o1', notifications },
  incidentsConfig: { regimes: [{ code: 'NIS2', actif: true }] },
})

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.load.mockResolvedValue(ctx())
  m.update.mockImplementation(async (a: { data: { notifications: unknown } }) => ({ notifications: a.data.notifications }))
})

describe('POST notifications', () => {
  it('401 sans session', async () => {
    m.session.mockResolvedValue(null)
    expect((await POST(req({}), params)).status).toBe(401)
  })
  it('refuse un rôle non habilité (403)', async () => {
    m.load.mockResolvedValue(ctx('LECTEUR'))
    expect((await POST(req({ regime: 'NIS2', phase: 'ALERTE_PRECOCE' }), params)).status).toBe(403)
    expect(m.update).not.toHaveBeenCalled()
  })
  it('refuse un régime ou une phase inconnus (400)', async () => {
    expect((await POST(req({ regime: 'NOPE', phase: 'X' }), params)).status).toBe(400)
    expect((await POST(req({ regime: 'NIS2', phase: 'X' }), params)).status).toBe(400)
  })
  it('enregistre la soumission (date par défaut = maintenant, référence) et journalise', async () => {
    const res = await POST(req({ regime: 'NIS2', phase: 'ALERTE_PRECOCE', reference: 'ANSSI-42' }), params)
    expect(res.status).toBe(200)
    const saved = m.update.mock.calls[0][0].data.notifications as { regime: string; phase: string; reference: string; soumisLe: string }[]
    expect(saved).toHaveLength(1)
    expect([saved[0].regime, saved[0].phase, saved[0].reference]).toEqual(['NIS2', 'ALERTE_PRECOCE', 'ANSSI-42'])
    expect(Number.isNaN(new Date(saved[0].soumisLe).getTime())).toBe(false)
    expect(m.audit).toHaveBeenCalled()
  })
  it('date de soumission invalide → 400', async () => {
    expect((await POST(req({ regime: 'NIS2', phase: 'ALERTE_PRECOCE', soumisLe: 'nope' }), params)).status).toBe(400)
  })
})

describe('DELETE notifications', () => {
  it('retire la soumission d’une phase', async () => {
    m.load.mockResolvedValue(ctx('RSSI', [{ regime: 'NIS2', phase: 'ALERTE_PRECOCE', soumisLe: '2026-09-29T10:00:00.000Z' }]))
    const res = await DELETE(req({ regime: 'NIS2', phase: 'ALERTE_PRECOCE' }, 'DELETE'), params)
    expect(res.status).toBe(200)
    expect(m.update.mock.calls[0][0].data.notifications).toEqual([])
  })
})
