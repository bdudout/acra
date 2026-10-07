/** Suppression d'un incident : tracée dans le journal d'audit et placée en corbeille ; restauration par un administrateur. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  session: vi.fn(), load: vi.fn(), audit: vi.fn(),
  tx: {
    incident: { findUnique: vi.fn(), delete: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    incidentRisque: { findMany: vi.fn(), createMany: vi.fn() },
    elementSupprime: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    processus: { findMany: vi.fn() }, riskItem: { findMany: vi.fn() },
  },
}))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { ...m.tx, $transaction: async (f: (tx: unknown) => unknown) => f(m.tx) } }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/incident-access.server', () => ({ loadIncidentInScope: m.load, peutQualifier: (role: string) => ['RISK_MANAGER', 'RSSI', 'ADMIN'].includes(role) }))
vi.mock('@/lib/org-context.server', () => ({ getAdminOrgIds: vi.fn(async () => ({ all: false, ids: ['o1'] })) }))
import { DELETE } from '@/app/api/incidents/[id]/route'
import { PATCH as RESTAURER } from '@/app/api/admin/recovery/elements/[id]/route'

const incident = { id: 'i1', organizationId: 'o1', intitule: 'Panne du SI', dateSurvenance: new Date('2026-09-01T00:00:00Z'), montantBrut: null, recuperations: null, processusId: null, riskItemId: null, createdAt: new Date('2026-09-01T00:00:00Z'), updatedAt: new Date() }
beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
  m.load.mockResolvedValue({ userId: 'u1', userRole: 'RSSI', secondeLigneActive: true, incident: { id: 'i1', organizationId: 'o1', intitule: 'Panne du SI' } })
  m.tx.incident.findUnique.mockResolvedValue(incident)
  m.tx.incidentRisque.findMany.mockResolvedValue([{ riskItemId: 'ri1' }])
  m.tx.elementSupprime.create.mockResolvedValue({ id: 'c1' })
})

describe('DELETE /api/incidents/[id]', () => {
  it('instantané en corbeille, puis suppression, et trace d’audit dédiée', async () => {
    const r = await DELETE(new NextRequest('http://x/api/incidents/i1', { method: 'DELETE' }), { params: Promise.resolve({ id: 'i1' }) })
    expect(r!.status).toBe(200)
    const c = m.tx.elementSupprime.create.mock.calls[0][0].data
    expect(c).toMatchObject({ organizationId: 'o1', type: 'INCIDENT', objetId: 'i1', intitule: 'Panne du SI', supprimeParId: 'u1' })
    expect(c.donnees).toMatchObject({ incident: { id: 'i1', dateSurvenance: '2026-09-01T00:00:00.000Z' }, risqueIds: ['ri1'] })
    expect(m.tx.incident.delete).toHaveBeenCalledWith({ where: { id: 'i1' } })
    expect(m.audit).toHaveBeenCalledWith('INCIDENT_DELETED', expect.objectContaining({ organizationId: 'o1', targetId: 'i1', details: expect.objectContaining({ intitule: 'Panne du SI', corbeilleId: 'c1' }) }))
  })
})

describe('PATCH /api/admin/recovery/elements/[id] — restauration', () => {
  const params = { params: Promise.resolve({ id: 'c1' }) }
  const req = () => new NextRequest('http://x', { method: 'PATCH' })
  it('ADMIN de l’organisation : incident recréé à l’identique avec ses liens encore valides ; corbeille vidée ; audit', async () => {
    m.tx.elementSupprime.findFirst.mockResolvedValue({ id: 'c1', organizationId: 'o1', type: 'INCIDENT', objetId: 'i1', intitule: 'Panne du SI', donnees: { incident: { id: 'i1', organizationId: 'o1', intitule: 'Panne du SI', processusId: 'pr-disparu' }, risqueIds: ['ri1', 'ri-disparu'] } })
    m.tx.incident.findFirst.mockResolvedValue(null)
    m.tx.processus.findMany.mockResolvedValue([])
    m.tx.riskItem.findMany.mockResolvedValue([{ id: 'ri1' }])
    const r = await RESTAURER(req(), params)
    expect(r!.status).toBe(200)
    expect(m.tx.elementSupprime.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'c1', organizationId: { in: ['o1'] } })
    expect(m.tx.incident.create.mock.calls[0][0].data).toMatchObject({ id: 'i1', processusId: null })
    expect(m.tx.incidentRisque.createMany).toHaveBeenCalledWith({ data: [{ incidentId: 'i1', riskItemId: 'ri1' }], skipDuplicates: true })
    expect(m.tx.elementSupprime.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
    expect(m.audit).toHaveBeenCalledWith('INCIDENT_RESTORED', expect.objectContaining({ targetId: 'i1' }))
  })
  it('hors administrateur : 403 ; élément d’une autre organisation : 404', async () => {
    m.session.mockResolvedValueOnce({ user: { id: 'u2', role: 'ANALYSTE' } })
    expect((await RESTAURER(req(), params))!.status).toBe(403)
    m.tx.elementSupprime.findFirst.mockResolvedValue(null)
    expect((await RESTAURER(req(), params))!.status).toBe(404)
    expect(m.tx.incident.create).not.toHaveBeenCalled()
  })
})
