/** PATCH /api/incidents/[id] — association à un ou plusieurs risques du registre (même organisation). */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), load: vi.fn(), update: vi.fn(), audit: vi.fn(), count: vi.fn(), del: vi.fn(), create: vi.fn(), tx: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  incident: { update: m.update }, processus: { findFirst: vi.fn() }, riskItem: { findFirst: vi.fn(async () => ({ id: 'r1' })), count: m.count },
  incidentRisque: { deleteMany: m.del, createMany: m.create }, $transaction: m.tx,
} }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/incident-access.server', () => ({ loadIncidentInScope: m.load, peutQualifier: (role: string) => ['RISK_MANAGER', 'RSSI', 'ADMIN'].includes(role) }))
import { PATCH } from '@/app/api/incidents/[id]/route'

const params = { params: Promise.resolve({ id: 'i1' }) }
const patch = (body: unknown) => PATCH(new NextRequest('http://x/api/incidents/i1', { method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), params)

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'RSSI' } })
  m.load.mockResolvedValue({ userId: 'u1', userRole: 'RSSI', secondeLigneActive: true,
    incident: { id: 'i1', organizationId: 'o1', statut: 'QUALIFIE', declarantId: 'u0', intitule: 'DDoS', pertes: [], recuperationsLignes: [], quasiIncident: false, champs: {}, taxonomieCode: 'CYBER' },
    incidentsConfig: {}, champsPersonnalises: {} })
  m.update.mockImplementation((a: { data: object }) => ({ id: 'i1', statut: 'QUALIFIE', ...a.data }))
  m.del.mockReturnValue('DEL'); m.create.mockReturnValue('CREATE')
  m.tx.mockImplementation(async (ops: unknown[]) => ops.map(o => (typeof o === 'string' ? o : o)))
})

describe('association incident → risques du registre', () => {
  it('plusieurs risques : liaisons remplacées, le premier devient le risque principal', async () => {
    m.count.mockResolvedValue(2)
    const res = await patch({ riskItemIds: ['r2', 'r1', 'r2'] })
    expect(res!.status).toBe(200)
    expect(m.count).toHaveBeenCalledWith({ where: { id: { in: ['r2', 'r1'] }, organizationId: 'o1' } })
    expect(m.update.mock.calls[0][0].data).toMatchObject({ riskItemId: 'r2' })
    expect(m.del).toHaveBeenCalledWith({ where: { incidentId: 'i1' } })
    expect(m.create).toHaveBeenCalledWith({ data: [{ incidentId: 'i1', riskItemId: 'r2' }, { incidentId: 'i1', riskItemId: 'r1' }] })
  })
  it('un risque d’une autre organisation (ou inconnu) est refusé', async () => {
    m.count.mockResolvedValue(1)
    expect((await patch({ riskItemIds: ['r1', 'autre'] }))!.status).toBe(400)
    expect(m.update).not.toHaveBeenCalled()
  })
  it('liste vide : plus aucun risque associé', async () => {
    expect((await patch({ riskItemIds: [] }))!.status).toBe(200)
    expect(m.update.mock.calls[0][0].data).toMatchObject({ riskItemId: null })
    expect(m.create).not.toHaveBeenCalled()
  })
  it('sans liste fournie : les liaisons ne sont pas touchées', async () => {
    expect((await patch({ intitule: 'DDoS massif' }))!.status).toBe(200)
    expect(m.del).not.toHaveBeenCalled()
  })
})
