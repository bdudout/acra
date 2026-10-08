// @vitest-environment node
// /api/ropa/sous-traitance : registre du sous-traitant (RGPD art. 30 §2) — module activable (404 s'il est inactif),
// DPO / ADMIN, borné à l'organisation active, complétude du §2 renvoyée, écritures journalisées.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), config: vi.fn(), audit: vi.fn(), findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), del: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '' }))
vi.mock('@/lib/prisma', () => ({ prisma: { traitementSousTraitance: { findMany: m.findMany, create: m.create, findFirst: m.findFirst, update: m.update, delete: m.del } } }))
import { GET, POST } from '@/app/api/ropa/sous-traitance/route'
import { PATCH, DELETE } from '@/app/api/ropa/sous-traitance/[id]/route'

const req = (body?: object, method = 'POST') => new NextRequest('http://x/api/ropa/sous-traitance', body ? { method, body: JSON.stringify(body) } : { method })
const pid = { params: Promise.resolve({ id: 's1' }) }
const LIGNE = { id: 's1', organizationId: 'o1', clientNom: 'Hôpital X', clientContact: 'dpo@h.fr', clientDpo: '', categoriesTraitements: ['Hébergement'], transfertHorsUE: false, paysTransfert: '', garantiesTransfert: '', mesuresSecurite: [] }

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'DPO' })
  m.config.mockResolvedValue({ ropaSousTraitantActive: true })
  m.findMany.mockResolvedValue([LIGNE])
  m.findFirst.mockResolvedValue(LIGNE)
  m.create.mockImplementation(async ({ data }: { data: object }) => ({ id: 'n', ...data }))
  m.update.mockImplementation(async ({ data }: { data: object }) => ({ ...LIGNE, ...data }))
})

describe('/api/ropa/sous-traitance', () => {
  it('GET : lignes de l’organisation active avec la complétude du § 2', async () => {
    const j = await (await GET()).json()
    expect(m.findMany.mock.calls[0][0].where).toEqual({ organizationId: 'o1' })
    expect(j.lignes[0].manquants).toEqual(['mesuresSecurite'])
  })
  it('module inactif → 404 ; autre rôle → 403', async () => {
    m.config.mockResolvedValue({ ropaSousTraitantActive: false })
    expect((await GET()).status).toBe(404)
    m.config.mockResolvedValue({ ropaSousTraitantActive: true })
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
    expect((await GET()).status).toBe(403)
  })
  it('POST : responsable client requis ; créé pour l’organisation active, journalisé', async () => {
    expect((await POST(req({ clientNom: ' ' }))).status).toBe(400)
    const r = await POST(req({ clientNom: 'Hôpital X', organizationId: 'autre', categoriesTraitements: ['Hébergement'] }))
    expect(r.status).toBe(201)
    expect(m.create.mock.calls[0][0].data).toMatchObject({ organizationId: 'o1', clientNom: 'Hôpital X', createdBy: 'u1' })
    expect(m.audit).toHaveBeenCalledWith('ORGANIZATION_CONFIG_UPDATED', expect.objectContaining({ details: expect.objectContaining({ scope: 'ropa-sous-traitance', action: 'create' }) }))
  })
  it('PATCH / DELETE : ligne d’une autre organisation → 404', async () => {
    m.findFirst.mockResolvedValue(null)
    expect((await PATCH(req({ clientNom: 'Y' }, 'PATCH'), pid)).status).toBe(404)
    expect((await DELETE(req(undefined, 'DELETE'), pid)).status).toBe(404)
    expect(m.findFirst.mock.calls[0][0].where).toEqual({ id: 's1', organizationId: 'o1' })
  })
  it('PATCH : mise à jour fusionnée et nettoyée ; DELETE : suppression', async () => {
    expect((await PATCH(req({ mesuresSecurite: ['Chiffrement'] }, 'PATCH'), pid)).status).toBe(200)
    expect(m.update.mock.calls[0][0].data).toMatchObject({ clientNom: 'Hôpital X', mesuresSecurite: ['Chiffrement'] })
    expect((await DELETE(req(undefined, 'DELETE'), pid)).status).toBe(200)
    expect(m.del).toHaveBeenCalledWith({ where: { id: 's1' } })
  })
})
