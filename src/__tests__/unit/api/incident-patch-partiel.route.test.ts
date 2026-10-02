/** PATCH /api/incidents/[id] — mise à jour PARTIELLE (horodatages DORA, attributs de notification) sans renvoyer toute la fiche. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), load: vi.fn(), update: vi.fn(), audit: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { incident: { update: m.update }, processus: { findFirst: vi.fn() }, riskItem: { findFirst: vi.fn() } } }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/incident-access.server', () => ({ loadIncidentInScope: m.load, peutQualifier: (role: string) => ['RISK_MANAGER', 'RSSI', 'ADMIN'].includes(role) }))
import { PATCH } from '@/app/api/incidents/[id]/route'

const params = { params: Promise.resolve({ id: 'i1' }) }
const patch = (body: unknown) => PATCH(new NextRequest('http://x/api/incidents/i1', { method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), params)
const stored = (statut = 'QUALIFIE') => ({ userId: 'u1', userRole: 'RSSI', secondeLigneActive: true,
  incident: { id: 'i1', organizationId: 'o1', statut, declarantId: 'u0', intitule: 'Panne du SI', pertes: [], recuperationsLignes: [], quasiIncident: false, champs: {}, taxonomieCode: 'CYBER' },
  incidentsConfig: {}, champsPersonnalises: {} })

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.load.mockResolvedValue(stored())
  m.update.mockImplementation(async (a: { data: object }) => ({ id: 'i1', intitule: 'Panne du SI', statut: 'QUALIFIE', ...a.data }))
})

describe('PATCH partiel', () => {
  it('un horodatage DORA seul est accepté et n’écrit QUE ce champ (ni intitulé, ni statut)', async () => {
    const res = await patch({ doraInitialeSoumiseLe: '2026-10-05T10:15:00.000Z' })
    expect(res!.status).toBe(200)
    const data = m.update.mock.calls[0][0].data
    expect(Object.keys(data)).toEqual(['doraInitialeSoumiseLe']); expect(data.doraInitialeSoumiseLe).toEqual(new Date('2026-10-05T10:15:00.000Z'))
  })
  it('un horodatage remis à null (case décochée) est écrit à null', async () => {
    expect((await patch({ doraInitialeSoumiseLe: null }))!.status).toBe(200)
    expect(m.update.mock.calls[0][0].data).toEqual({ doraInitialeSoumiseLe: null })
  })
  it('les attributs de notification seuls sont acceptés (ajout d’un régulateur)', async () => {
    expect((await patch({ attributs: { significatif: true, regimes: ['CRA_14'] } }))!.status).toBe(200)
    expect(m.update.mock.calls[0][0].data.attributs).toEqual({ significatif: true, regimes: ['CRA_14'] })
  })
  it('l’état de l’incident n’est pas modifié par un PATCH partiel (pas de retour implicite à DECLARE)', async () => {
    m.load.mockResolvedValue(stored('CLOTURE'))
    expect((await patch({ doraFinaleSoumiseLe: '2026-10-05T10:15:00.000Z' }))!.status).toBe(200)
    expect(m.update.mock.calls[0][0].data).not.toHaveProperty('statut')
  })
  it('un corps explicite reste validé : intitulé vide refusé, date invalide refusée, rôle non habilité refusé', async () => {
    expect((await patch({ intitule: '  ' }))!.status).toBe(400)
    expect((await patch({ doraInitialeSoumiseLe: 'pas une date' }))!.status).toBe(400)
    m.load.mockResolvedValue({ ...stored(), userRole: 'ANALYSTE' })
    expect((await patch({ doraInitialeSoumiseLe: '2026-10-05T10:15:00.000Z' }))!.status).toBe(403)
    expect(m.update).not.toHaveBeenCalled()
  })
})
