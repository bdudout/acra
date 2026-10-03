/**
 * Contrôles de référence en réseau : déclinaison (droits de la mère, cibles = descendants visibles, idempotence,
 * module inactif dans une entité) et consolidation (isolation : seules les entités visibles).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ userId: 'u', role: 'RSSI', orgRole: 'RSSI' as string | null, all: false, ids: ['mere', 'f1', 'f2'], modules: { mere: true, f1: true, f2: false } as Record<string, boolean> }))
const db = vi.hoisted(() => ({
  controle: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  organization: { findUnique: vi.fn(), findMany: vi.fn() },
}))
const auditLog = vi.hoisted(() => vi.fn())

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => (state.userId ? { user: { id: state.userId, role: state.role } } : null)) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/org-context.server', () => ({
  getAccessibleOrgIds: vi.fn(async () => ({ all: state.all, ids: state.ids })),
  getEffectiveRoleForOrg: vi.fn(async () => state.orgRole),
  getAnalyseScope: vi.fn(async () => ({ role: state.orgRole ?? state.role, activeOrgId: 'mere', scope: { isSuperAdmin: false, visibleOrgIds: state.ids }, memberships: [] })),
}))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async (id: string) => ({ controlePermanentActive: state.modules[id] ?? false, secondeLigneActive: true })) }))
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => auditLog(...a), getClientIp: () => '' }))

import { POST } from '@/app/api/controles/[id]/decliner/route'
import { GET } from '@/app/api/controles/reseau/route'

const ORGS = [
  { id: 'mere', path: '/mere/', nom: 'Mère' },
  { id: 'f1', path: '/mere/f1/', nom: 'Filiale 1' },
  { id: 'f2', path: '/mere/f2/', nom: 'Filiale 2' },
  { id: 'f3', path: '/mere/f3/', nom: 'Filiale 3 (non visible)' },
]
const REF = { id: 'c-ref', organizationId: 'mere', intitule: 'Revue des accès', periodicite: 'TRIMESTRIEL', referenceId: null, estReference: false, checklist: [], exigenceRefs: [] }
const req = (body?: unknown, url = 'http://x/api/controles/reseau') => ({ json: async () => body ?? {}, headers: new Headers(), nextUrl: new URL(url), url }) as never
const decliner = async (body?: unknown) => (await POST(req(body), { params: Promise.resolve({ id: 'c-ref' }) }))!

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(state, { userId: 'u', role: 'RSSI', orgRole: 'RSSI', all: false, ids: ['mere', 'f1', 'f2'], modules: { mere: true, f1: true, f2: false } })
  db.controle.findUnique.mockResolvedValue({ ...REF })
  db.controle.findMany.mockResolvedValue([])
  db.controle.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: `c-${a.data.organizationId}`, ...a.data }))
  db.controle.update.mockResolvedValue({ ...REF, estReference: true })
  db.organization.findUnique.mockResolvedValue(ORGS[0])
  db.organization.findMany.mockResolvedValue(ORGS)
})

describe('POST /api/controles/[id]/decliner', () => {
  it('401 sans session ; 404 hors périmètre', async () => {
    state.userId = ''
    expect((await decliner()).status).toBe(401)
    state.userId = 'u'; db.controle.findUnique.mockResolvedValueOnce({ ...REF, organizationId: 'ailleurs' })
    expect((await decliner()).status).toBe(404)
  })
  it('403 pour un rôle qui ne définit pas le plan de contrôle', async () => {
    state.orgRole = 'ANALYSTE'
    expect((await decliner()).status).toBe(403)
  })
  it('décline dans les descendants visibles où le module est actif ; les autres sont signalés ; audit', async () => {
    const res = await decliner()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(db.controle.create).toHaveBeenCalledTimes(1)
    expect(db.controle.create.mock.calls[0][0].data).toMatchObject({ organizationId: 'f1', referenceId: 'c-ref', intitule: 'Revue des accès' })
    expect(body.crees).toEqual(['f1'])
    expect(body.ignores).toEqual([{ organizationId: 'f2', raison: 'module_inactif' }])
    expect(db.controle.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c-ref' }, data: { estReference: true } }))
    expect(auditLog).toHaveBeenCalledWith('CONTROLE_DECLINE', expect.anything())
  })
  it('idempotente : une entité déjà dotée n’est pas recréée', async () => {
    db.controle.findMany.mockResolvedValueOnce([{ organizationId: 'f1' }])
    const body = await (await decliner()).json()
    expect(db.controle.create).not.toHaveBeenCalled()
    expect(body.dejaDeclinees).toBe(1)
  })
  it('une déclinaison ne peut pas elle-même être déclinée', async () => {
    db.controle.findUnique.mockResolvedValueOnce({ ...REF, referenceId: 'autre' })
    expect((await decliner()).status).toBe(409)
  })
})

describe('GET /api/controles/reseau', () => {
  it('consolide les références de l’organisation active sur les seules entités visibles', async () => {
    db.controle.findMany
      .mockResolvedValueOnce([{ ...REF, estReference: true, createdAt: new Date('2026-01-01') }]) // références
      .mockResolvedValueOnce([{ id: 'c-f1', organizationId: 'f1', actif: true, periodicite: 'TRIMESTRIEL', createdAt: new Date('2026-01-01'), referenceId: 'c-ref', executions: [{ resultat: 'CONFORME', dateRealisation: new Date('2026-09-20') }] }]) // déclinaisons
      .mockResolvedValueOnce([]) // candidats
    const res = await GET(req())
    const body = await res.json()
    expect(db.controle.findMany.mock.calls[1][0].where).toMatchObject({ referenceId: { in: ['c-ref'] }, organizationId: { in: ['mere', 'f1', 'f2'] } })
    expect(body.entites.map((e: { id: string }) => e.id)).toEqual(['f1', 'f2'])
    expect(body.references[0].cellules).toEqual([expect.objectContaining({ organizationId: 'f1', dernierResultat: 'CONFORME' })])
    expect(body.references[0].synthese).toMatchObject({ entites: 1, conformes: 1 })
  })
  it('module inactif → inactive', async () => {
    state.modules.mere = false
    expect(await (await GET(req())).json()).toMatchObject({ active: false })
  })
})
