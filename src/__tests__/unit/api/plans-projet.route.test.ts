/** GET /api/analyses/[id]/plans-projet — plans du projet triés par priorité ; lecture seule ; hors projet 360 → 404. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ planAction: { findMany: vi.fn() }, risque: { findMany: vi.fn() } }))
const guard = vi.hoisted(() => ({ value: { ok: true, analyse: { id: 'p1', organizationId: 'o1' } } as unknown }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u', role: 'LECTEUR' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/analyse-direct-risk.server', () => ({ guardLectureProjet360: vi.fn(async () => guard.value) }))
import { GET } from '@/app/api/analyses/[id]/plans-projet/route'

const params = { params: Promise.resolve({ id: 'p1' }) }
beforeEach(() => {
  vi.clearAllMocks()
  guard.value = { ok: true, analyse: { id: 'p1', organizationId: 'o1' } }
  db.risque.findMany.mockResolvedValue([{ id: 'r1', nom: 'Fuite', niveauRisque: 12, niveauActuel: 9 }, { id: 'r2', nom: 'Retard', niveauRisque: 4, niveauActuel: null }])
  db.planAction.findMany.mockResolvedValue([
    { id: 'a', titre: 'Former l’équipe', statut: 'A_FAIRE', priorite: 'MAJEUR', echeance: null, porteur: null, liens: [{ targetId: 'r2' }] },
    { id: 'b', titre: 'Chiffrer les sauvegardes', statut: 'EN_COURS', priorite: 'MAJEUR', echeance: null, porteur: 'DSI', liens: [{ targetId: 'r1' }] },
  ])
})

describe('plans du projet par priorité', () => {
  it('liés aux risques du projet (même organisation), risque le plus élevé en premier', async () => {
    const body = await (await GET({} as never, params)).json()
    expect(db.planAction.findMany.mock.calls[0][0].where).toEqual({ organizationId: 'o1', liens: { some: { type: 'RISQUE_ANALYSE', ref: 'p1' } } })
    expect(body.plans.map((p: { id: string }) => p.id)).toEqual(['b', 'a'])
    expect(body.plans[0]).toMatchObject({ niveauMax: 9, risques: [{ id: 'r1', nom: 'Fuite', niveau: 9 }] })
  })
  it('hors périmètre ou hors projet 360 → statut de la garde', async () => {
    guard.value = { ok: false, status: 404, error: 'Analyse introuvable' }
    expect((await GET({} as never, params)).status).toBe(404)
  })
})
