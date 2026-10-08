// Référentiel des entités (consolidation, lot E1) — routes : lecture par tout membre de l'organisation active,
// écriture ADMIN, doublons, liens hors organisation, champs verrouillés quand l'annuaire fait foi, suppression
// refusée tant que l'entité est référencée.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  session: vi.fn(), scope: vi.fn(), audit: vi.fn(), orgFind: vi.fn(), orgFindMany: vi.fn(), cfgFind: vi.fn(),
  findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), del: vi.fn(),
}))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '' }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: async () => ({ allowed: true }), LIMIT_API_WRITE: { limit: 9, windowMs: 1 } }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  organization: { findUnique: m.orgFind, findMany: m.orgFindMany },
  organizationConfig: { findUnique: m.cfgFind },
  entite: { findMany: m.findMany, findFirst: m.findFirst, create: m.create, update: m.update, delete: m.del },
} }))

import { GET, POST } from '@/app/api/referentiel-entites/route'
import { PATCH, DELETE } from '@/app/api/referentiel-entites/[id]/route'

const req = (body?: unknown, method = 'POST') => new NextRequest('http://x/api/referentiel-entites', body !== undefined ? { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : { method: method === 'POST' ? 'GET' : method })
const pid = { params: Promise.resolve({ id: 'e1' }) }
const ENT = (o = {}) => ({ id: 'e1', organizationId: 'o1', nom: 'DSI', type: 'SERVICE', alias: [], codeExterne: null, parentId: null, organisationLieeId: null, source: 'MANUEL', valideDu: null, valideAu: null, _count: { risques: 0, incidents: 0, conformites: 0, plansAction: 0, traitementsConformite: 0, mesures: 0, enfants: 0 }, ...o })

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'ADMIN' })
  m.orgFind.mockImplementation(async ({ where }: { where: { id: string } }) => ({ o1: { path: '/o1/' }, f1: { path: '/o1/f1/' }, x9: { path: '/x9/' } } as Record<string, { path: string }>)[where.id] ?? null)
  m.orgFindMany.mockResolvedValue([])
  m.cfgFind.mockResolvedValue(null)
  m.findMany.mockResolvedValue([ENT()])
  m.findFirst.mockResolvedValue(null)
  m.create.mockImplementation(async (a: { data: object }) => ({ id: 'e2', ...a.data }))
  m.update.mockImplementation(async (a: { data: object }) => ({ ...ENT(), ...a.data }))
})

describe('lecture', () => {
  it('tout membre lit le référentiel de l’organisation active ; seul l’ADMIN peut le modifier', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'METIER' })
    const r = await GET()
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(m.findMany.mock.calls[0][0].where).toEqual({ organizationId: 'o1' })
    expect(j.peutModifier).toBe(false)
    expect(j.sourceVerite).toBe('ACRA')
  })
  it('sans organisation active → 400', async () => {
    m.scope.mockResolvedValue({ activeOrgId: null, role: 'SUPER_ADMIN' })
    expect((await GET()).status).toBe(400)
  })
})

describe('création', () => {
  it('non-ADMIN → 403', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
    expect((await POST(req({ nom: 'Achats', type: 'DIRECTION' }))).status).toBe(403)
  })
  it('crée dans l’organisation active, source MANUEL', async () => {
    const r = await POST(req({ nom: 'Achats', type: 'DIRECTION', alias: ['ACH'], organizationId: 'x9', source: 'ANNUAIRE' }))
    expect(r.status).toBe(201)
    expect(m.create.mock.calls[0][0].data).toMatchObject({ organizationId: 'o1', nom: 'Achats', source: 'MANUEL', alias: ['ACH'] })
    expect(m.audit).toHaveBeenCalledWith('ENTITE_REFERENTIEL_UPDATED', expect.objectContaining({ organizationId: 'o1' }))
  })
  it('doublon probable (nom ou alias identique) → 409 avec la correspondance, sauf confirmation', async () => {
    m.findMany.mockResolvedValue([ENT({ nom: 'Direction des SI', alias: ['DSI'] })])
    const r = await POST(req({ nom: 'dsi', type: 'SERVICE' }))
    expect(r.status).toBe(409)
    expect((await r.json()).correspondances[0]).toMatchObject({ id: 'e1' })
    expect((await POST(req({ nom: 'dsi', type: 'SERVICE', confirmer: true }))).status).toBe(201)
  })
  it('organisation liée hors du sous-arbre → 400 ; filiale du sous-arbre acceptée', async () => {
    expect((await POST(req({ nom: 'Filiale X', type: 'FILIALE', organisationLieeId: 'x9' }))).status).toBe(400)
    expect((await POST(req({ nom: 'Filiale F', type: 'FILIALE', organisationLieeId: 'f1' }))).status).toBe(201)
  })
  it('parent d’une autre organisation → 400 ; code externe déjà pris → 409', async () => {
    expect((await POST(req({ nom: 'Y', type: 'SITE', parentId: 'autre' }))).status).toBe(400)
    m.findFirst.mockResolvedValue({ id: 'e9' })
    expect((await POST(req({ nom: 'Z', type: 'SITE', codeExterne: 'C1' }))).status).toBe(409)
  })
})

describe('modification', () => {
  it('entité d’une autre organisation → 404', async () => {
    m.findFirst.mockResolvedValue(null)
    expect((await PATCH(req({ nom: 'X' }, 'PATCH'), pid)).status).toBe(404)
  })
  it('annuaire source de vérité : nom verrouillé pour une entité venue de l’annuaire, alias modifiables', async () => {
    m.cfgFind.mockResolvedValue({ entitesSyncConfig: { type: 'LDAP', sourceVerite: 'ANNUAIRE' } })
    m.findFirst.mockResolvedValueOnce(ENT({ source: 'ANNUAIRE' }))
    const r = await PATCH(req({ nom: 'Autre nom' }, 'PATCH'), pid)
    expect(r.status).toBe(409)
    expect((await r.json()).error).toBe('champ_verrouille')
    m.findFirst.mockResolvedValueOnce(ENT({ source: 'ANNUAIRE' })).mockResolvedValue(null)
    expect((await PATCH(req({ alias: ['Informatique'] }, 'PATCH'), pid)).status).toBe(200)
  })
  it('rattachement à un descendant → 400 (boucle)', async () => {
    m.findFirst.mockResolvedValueOnce(ENT())
    m.findMany.mockResolvedValue([ENT(), ENT({ id: 'e2', parentId: 'e1' })])
    const r = await PATCH(req({ parentId: 'e2' }, 'PATCH'), pid)
    expect(r.status).toBe(400)
    expect((await r.json()).error).toBe('cycle')
  })
  it('clôture : date de fin enregistrée', async () => {
    m.findFirst.mockResolvedValueOnce(ENT()).mockResolvedValue(null)
    expect((await PATCH(req({ valideAu: '2026-12-31' }, 'PATCH'), pid)).status).toBe(200)
    expect(m.update.mock.calls[0][0].data.valideAu).toEqual(new Date('2026-12-31'))
  })
})

describe('suppression', () => {
  it('refusée tant que l’entité est référencée (il faut la clore) ; acceptée sinon', async () => {
    m.findFirst.mockResolvedValueOnce(ENT({ _count: { ...ENT()._count, risques: 2 } }))
    const r = await DELETE(req(undefined, 'DELETE'), pid)
    expect(r.status).toBe(409)
    expect((await r.json()).error).toBe('entite_referencee')
    m.findFirst.mockResolvedValueOnce(ENT())
    expect((await DELETE(req(undefined, 'DELETE'), pid)).status).toBe(200)
    expect(m.del).toHaveBeenCalledWith({ where: { id: 'e1' } })
  })
})
