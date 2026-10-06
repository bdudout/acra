/** Plan d'action d'un risque : modification seulement si le risque appartient à l'analyse éditée (pas d'IDOR inter-analyses). */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ risque: { count: vi.fn() }, planAction: { count: vi.fn(), update: vi.fn(), delete: vi.fn() } }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/analyse-direct-risk.server', () => ({ guardDirectRisk: vi.fn(async () => ({ ok: true, analyse: { id: 'A', organizationId: 'o', methode: 'PROJET_360' } })) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: () => '' }))

import { PATCH, DELETE } from '@/app/api/analyses/[id]/risques/[riskId]/plans/[planId]/route'

const params = { params: Promise.resolve({ id: 'A', riskId: 'rB', planId: 'p' }) }
const req = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as never
beforeEach(() => {
  vi.clearAllMocks()
  db.planAction.count.mockResolvedValue(1)
  db.planAction.update.mockImplementation(async (a: { data: object }) => ({ id: 'p', titre: 't', statut: 'A_FAIRE', priorite: 'MAJEUR', echeance: null, porteur: null, ...a.data }))
})

describe('PATCH / DELETE plan de risque', () => {
  it('risque d’une autre analyse : 404, rien de modifié ni supprimé', async () => {
    db.risque.count.mockResolvedValue(0)
    expect((await PATCH(req({ porteur: 'X' }), params)).status).toBe(404)
    expect((await DELETE(req({}), params)).status).toBe(404)
    expect(db.risque.count).toHaveBeenCalledWith({ where: { id: 'rB', analyseId: 'A' } })
    expect(db.planAction.update).not.toHaveBeenCalled()
    expect(db.planAction.delete).not.toHaveBeenCalled()
  })
  it('échéance illisible ignorée (pas d’erreur 500) ; porteur enregistré', async () => {
    db.risque.count.mockResolvedValue(1)
    const r = await PATCH(req({ porteur: ' DPO ', echeance: 'pas-une-date' }), params)
    expect(r.status).toBe(200)
    expect(db.planAction.update.mock.calls[0][0].data).toEqual({ porteur: 'DPO' })
  })
})
