/**
 * Homologations : module optionnel, isolation par organisation (404 hors périmètre), préparation par la
 * gouvernance, décision par l'autorité (jamais le préparateur), dossier complet exigé, journal d'audit.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ userId: 'prep', role: 'RSSI', module: true, orgRole: null as string | null }))
const db = vi.hoisted(() => ({
  homologation: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  analyse: { findFirst: vi.fn() },
  orgMembership: { findFirst: vi.fn(), findMany: vi.fn() },
  user: { findMany: vi.fn() },
}))
const auditLog = vi.hoisted(() => vi.fn())

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (state.userId ? { user: { id: state.userId, role: state.role } } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/org-context.server', () => ({
  getAnalyseScope: vi.fn(async () => ({ role: state.role, activeOrgId: 'org1', scope: { isSuperAdmin: false, visibleOrgIds: ['org1'] }, memberships: [] })),
  getAccessibleOrgIds: vi.fn(async () => ({ all: false, ids: ['org1'] })),
  getEffectiveRoleForOrg: vi.fn(async () => state.orgRole),
  analyseAccessWhere: vi.fn(async (_u: string, _r: string, id: string) => ({ id })),
}))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ homologationsActive: state.module })) }))
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => auditLog(...a), getClientIp: () => '' }))

import { GET as GET0, POST } from '@/app/api/homologations/route'
import { PATCH } from '@/app/api/homologations/[id]/route'
import { piecesInitiales } from '@/lib/homologation'

const GET = (_r?: unknown) => GET0()
const req = (body?: unknown) => ({ json: async () => body ?? {}, headers: new Headers(), nextUrl: new URL('http://x/api/homologations') }) as never
const patch = async (body: unknown) => (await PATCH(req(body), { params: Promise.resolve({ id: 'h1' }) }))!
const complet = piecesInitiales().map(p => ({ ...p, fourni: true }))
const base = { id: 'h1', organizationId: 'org1', analyseId: null, systeme: 'Portail', statut: 'COMMISSION', preparePar: 'prep', autoriteId: 'auto', dureeMois: 36, pieces: complet, reserves: [], dateFin: null }

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(state, { userId: 'prep', role: 'RSSI', module: true, orgRole: null })
  db.homologation.findMany.mockResolvedValue([])
  db.homologation.findUnique.mockResolvedValue({ ...base })
  db.homologation.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: 'h-new', ...a.data }))
  db.homologation.update.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ ...base, ...a.data }))
  db.orgMembership.findFirst.mockResolvedValue({ id: 'm' })
  db.orgMembership.findMany.mockResolvedValue([])
  db.user.findMany.mockResolvedValue([])
})

describe('GET / POST /api/homologations', () => {
  it('401 sans session ; 403 si le module est inactif', async () => {
    state.userId = ''
    expect((await GET(req())).status).toBe(401)
    state.userId = 'prep'; state.module = false
    expect((await GET(req())).status).toBe(403)
    expect((await POST(req({ systeme: 'X' }))).status).toBe(403)
  })
  it('liste restreinte aux organisations visibles', async () => {
    await GET(req())
    expect(db.homologation.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: { in: ['org1'] } })
  })
  it('création par la gouvernance seulement, dossier vierge, audit', async () => {
    state.role = 'ANALYSTE'
    expect((await POST(req({ systeme: 'Portail' }))).status).toBe(403)
    state.role = 'RSSI'
    expect((await POST(req({ systeme: '' }))).status).toBe(400)
    const res = await POST(req({ systeme: 'Portail usagers', dureeMois: 24 }))
    expect(res.status).toBe(201)
    const data = db.homologation.create.mock.calls[0][0].data
    expect(data).toMatchObject({ organizationId: 'org1', systeme: 'Portail usagers', statut: 'PREPARATION', preparePar: 'prep', dureeMois: 24 })
    expect(data.pieces).toHaveLength(6)
    expect(auditLog).toHaveBeenCalledWith('HOMOLOGATION_CREATED', expect.anything())
  })
  it('une analyse rattachée doit être accessible et de la même organisation', async () => {
    db.analyse.findFirst.mockResolvedValueOnce(null)
    expect((await POST(req({ systeme: 'X', analyseId: 'a-autre' }))).status).toBe(404)
    db.analyse.findFirst.mockResolvedValueOnce({ id: 'a1', organizationId: 'org2', deletedAt: null })
    expect((await POST(req({ systeme: 'X', analyseId: 'a1' }))).status).toBe(404)
  })
})

describe('PATCH /api/homologations/[id]', () => {
  it('404 hors périmètre', async () => {
    db.homologation.findUnique.mockResolvedValueOnce({ ...base, organizationId: 'org2' })
    expect((await patch({ action: 'transition', to: 'HOMOLOGUE' })).status).toBe(404)
  })
  it('le préparateur ne peut pas décider (séparation) ; l’autorité décide, validité calculée, audit', async () => {
    expect((await patch({ action: 'transition', to: 'HOMOLOGUE' })).status).toBe(403)
    state.userId = 'auto'; state.role = 'ANALYSTE'
    const res = await patch({ action: 'transition', to: 'HOMOLOGUE', commentaire: 'Accord' })
    expect(res.status).toBe(200)
    const data = db.homologation.update.mock.calls[0][0].data
    expect(data).toMatchObject({ statut: 'HOMOLOGUE', decidePar: 'auto', commentaireDecision: 'Accord' })
    expect(data.dateFin).toBeInstanceOf(Date)
    expect(auditLog).toHaveBeenCalledWith('HOMOLOGATION_TRANSITION', expect.objectContaining({ details: expect.objectContaining({ de: 'COMMISSION', vers: 'HOMOLOGUE' }) }))
  })
  it('dossier incomplet refusé (409) ; réserves exigées', async () => {
    db.homologation.findUnique.mockResolvedValueOnce({ ...base, pieces: piecesInitiales() })
    state.userId = 'auto'
    expect((await patch({ action: 'transition', to: 'HOMOLOGUE' })).status).toBe(409)
    expect((await patch({ action: 'transition', to: 'HOMOLOGUE_RESERVES', reserves: [] })).status).toBe(409)
  })
  it('mise à jour du dossier par la gouvernance pendant l’instruction seulement', async () => {
    const res = await patch({ action: 'update', pieces: complet, perimetre: 'Portail et API' })
    expect(res.status).toBe(200)
    db.homologation.findUnique.mockResolvedValueOnce({ ...base, statut: 'HOMOLOGUE' })
    expect((await patch({ action: 'update', perimetre: 'x' })).status).toBe(409)
  })
})
