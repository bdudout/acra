/**
 * Programme de tests de résilience (DORA) : module inactif → 404, lecture pour les
 * rôles à lecture globale, écriture pour les rôles d'évaluation DORA, liens (risques,
 * processus) filtrés sur l'organisation, test d'une autre org → 404, rapport Word.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ role: 'RSSI', active: true }))
const db = vi.hoisted(() => ({
  testResilience: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  riskItem: { findMany: vi.fn() },
  processus: { findFirst: vi.fn() },
  organization: { findUnique: vi.fn() },
  incident: { findMany: vi.fn() },
  planAction: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  arrangementTic: { findMany: vi.fn() },
  auditConstat: { findMany: vi.fn() },
}))
const auditLog = vi.hoisted(() => vi.fn())
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: vi.fn(async () => ({ role: state.role, activeOrgId: 'org1' })) }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ reglementaireActive: state.active })) }))
vi.mock('@/lib/i18n', async () => { const { fr } = await import('@/lib/i18n/fr'); return { getServerT: async () => fr } })
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => auditLog(...a), getClientIp: () => '' }))

import { GET, POST } from '@/app/api/tests-resilience/route'
import { PATCH, DELETE } from '@/app/api/tests-resilience/[id]/route'
import { GET as RAPPORT } from '@/app/api/tests-resilience/rapport/route'
import { POST as PROMOTE_CONSTAT } from '@/app/api/tests-resilience/[id]/actions/route'

const getReq = (q = '') => ({ nextUrl: new URL(`http://x/api/tests-resilience${q}`), headers: new Headers() }) as never
const req = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as never
const params = { params: Promise.resolve({ id: 't9' }) }
const valid = { annee: 2026, intitule: 'Pentest', type: 'PENETRATION', riskItemIds: ['r1', 'autre-org'], processusId: 'p-autre' }

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(state, { role: 'RSSI', active: true })
  db.testResilience.findMany.mockResolvedValue([])
  db.riskItem.findMany.mockResolvedValue([{ id: 'r1' }])
  db.processus.findFirst.mockResolvedValue(null)
  db.testResilience.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: 't1', ...a.data }))
  db.planAction.findFirst.mockResolvedValue(null)
  db.planAction.findMany.mockResolvedValue([])
  db.arrangementTic.findMany.mockResolvedValue([])
  db.auditConstat.findMany.mockResolvedValue([])
  db.planAction.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: 'pa1', ...a.data }))
})

describe('/api/tests-resilience', () => {
  it('module inactif → 404 ; 1re ligne → 403', async () => {
    state.active = false
    expect((await GET(getReq())).status).toBe(404)
    state.active = true; state.role = 'LECTEUR'
    expect((await GET(getReq())).status).toBe(403)
  })

  it('lecture (AUDITEUR) sans droit d’écriture', async () => {
    state.role = 'AUDITEUR'
    const res = await GET(getReq('?annee=2026'))
    expect(res.status).toBe(200)
    expect((await res.json()).canWrite).toBe(false)
    expect((await POST(req(valid))).status).toBe(403)
  })

  it('création : liens filtrés sur l’organisation, audit', async () => {
    const res = await POST(req(valid))
    expect(res.status).toBe(201)
    const data = db.testResilience.create.mock.calls[0][0].data
    expect(data).toMatchObject({ organizationId: 'org1', riskItemIds: ['r1'], processusId: null, createdById: 'u1' })
    expect(db.riskItem.findMany.mock.calls[0][0].where).toEqual({ organizationId: 'org1', id: { in: ['r1', 'autre-org'] } })
    expect(auditLog).toHaveBeenCalledWith('ADMIN_ACTION', expect.objectContaining({ targetType: 'test-resilience' }))
  })

  it('saisie invalide → 400', async () => {
    expect((await POST(req({ ...valid, type: 'X' }))).status).toBe(400)
  })

  it('test d’une autre organisation → 404 (PATCH et DELETE)', async () => {
    db.testResilience.findFirst.mockResolvedValue(null)
    expect((await PATCH(req(valid), params)).status).toBe(404)
    expect((await DELETE(req({}), params)).status).toBe(404)
    expect(db.testResilience.findFirst.mock.calls[0][0].where).toEqual({ id: 't9', organizationId: 'org1' })
    expect(db.testResilience.update).not.toHaveBeenCalled()
  })

  it('constat ouvert → plan d’action unifié, sans doublon', async () => {
    db.testResilience.findFirst.mockResolvedValue({ id: 't9', intitule: 'Pentest', constats: [{ description: 'MFA absent', severite: 4, corrige: false }] })
    const res = await PROMOTE_CONSTAT(req({ constatIndex: 0 }), params)
    expect(res.status).toBe(201)
    expect(db.planAction.create.mock.calls[0][0].data).toMatchObject({ organizationId: 'org1', priorite: 'CRITIQUE', liens: { create: { type: 'TEST_RESILIENCE', targetId: 't9', ref: 'constat:0' } } })
    db.planAction.findFirst.mockResolvedValue({ id: 'pa1' })
    expect((await PROMOTE_CONSTAT(req({ constatIndex: 0 }), params)).status).toBe(200)
  })

  it('rapport de réexamen : document Word, export journalisé', async () => {
    db.testResilience.findMany.mockResolvedValue([{ id: 't1', annee: 2026, intitule: 'Scan', type: 'VULNERABILITY', statut: 'REALISE', fonctionCritique: true, independant: true, testeur: 'INTERNE', dateRealisation: new Date('2026-04-01'), constats: [], riskItemIds: [] }])
    db.organization.findUnique.mockResolvedValue({ nom: 'Acme', slug: 'acme' })
    db.incident.findMany.mockResolvedValue([])
    const res = await RAPPORT(getReq('?annee=2026'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('wordprocessingml')
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.subarray(0, 2).toString()).toBe('PK')
    expect(auditLog).toHaveBeenCalledWith('EXPORT', expect.objectContaining({ targetType: 'test-resilience' }))
  })

  it('livrable DORA global : registre TIC, constats du régulateur et plans d’action des tests chargés dans l’organisation seulement', async () => {
    db.testResilience.findMany.mockResolvedValue([])
    db.organization.findUnique.mockResolvedValue({ nom: 'Acme', slug: 'acme' })
    db.incident.findMany.mockResolvedValue([])
    db.arrangementTic.findMany.mockResolvedValue([{ criticite: 'CRITIQUE', dateFin: new Date('2026-12-01'), questionnaire: [] }])
    db.auditConstat.findMany.mockResolvedValue([{ statut: 'OUVERT', echeance: new Date('2026-01-01') }])
    db.planAction.findMany.mockResolvedValue([{ statut: 'EN_COURS', echeance: new Date('2026-01-01') }])
    const res = await RAPPORT(getReq('?annee=2026'))
    expect(res.status).toBe(200)
    expect(db.arrangementTic.findMany.mock.calls[0][0].where).toEqual({ organizationId: 'org1' })
    expect(db.auditConstat.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: 'org1', source: 'REGULATEUR' })
    expect(db.planAction.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: 'org1', liens: { some: { type: 'TEST_RESILIENCE' } } })
  })
})
