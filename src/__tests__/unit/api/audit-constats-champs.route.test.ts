/** Champs personnalisés des constats d'audit : requis, restreints par rôle, préservés à la modification. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), config: vi.fn(), mFind: vi.fn(), cFind: vi.fn(), create: vi.fn(), update: vi.fn(), audit: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { auditMission: { findFirst: m.mFind }, auditConstat: { findFirst: m.cFind, create: m.create, update: m.update }, riskItem: { findFirst: vi.fn() } } }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))

import { POST } from '@/app/api/audit/missions/[id]/constats/route'
import { PATCH } from '@/app/api/audit/constats/[id]/route'

const defs = { constat: [{ code: 'proc', label: 'Procédure', type: 'TEXTE', requis: true }, { code: 'interne', label: 'Note interne', type: 'TEXTE', roles: ['ADMIN'] }] }
const req = (b: unknown, url = 'http://x') => new NextRequest(url, { method: 'POST', body: JSON.stringify(b) })

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'AUDITEUR', scope: { isSuperAdmin: false, visibleOrgIds: ['o1'] } })
  m.config.mockResolvedValue({ auditInterneActive: true, champsPersonnalises: defs })
  m.mFind.mockResolvedValue({ id: 'm1', organizationId: 'o1' })
  m.create.mockImplementation(async (a: { data: object }) => ({ id: 'c1', ...a.data }))
  m.update.mockImplementation(async (a: { data: object }) => ({ id: 'c1', ...a.data }))
})

describe('POST constat — champs personnalisés', () => {
  it('champ requis manquant → 400 champs_requis', async () => {
    const res = await POST(req({ intitule: 'Écart MFA' }), { params: Promise.resolve({ id: 'm1' }) })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'champs_requis', champs: ['proc'] })
  })
  it('valeurs enregistrées ; le champ réservé à ADMIN est ignoré pour un AUDITEUR et invisible en réponse', async () => {
    const res = await POST(req({ intitule: 'Écart MFA', champs: { proc: 'PR-12', interne: 'secret' } }), { params: Promise.resolve({ id: 'm1' }) })
    expect(res.status).toBe(201)
    expect(m.create.mock.calls[0][0].data.champs).toEqual({ proc: 'PR-12' })
    expect((await res.json()).champs).toEqual({ proc: 'PR-12' })
  })
})

describe('PATCH constat — champs personnalisés', () => {
  it('conserve la valeur réservée à un autre rôle (jamais écrasée ni divulguée)', async () => {
    m.cFind.mockResolvedValue({ id: 'c1', organizationId: 'o1', champs: { proc: 'PR-1', interne: 'secret' } })
    const res = await PATCH(new NextRequest('http://x', { method: 'PATCH', body: JSON.stringify({ champs: { proc: 'PR-2' } }) }), { params: Promise.resolve({ id: 'c1' }) })
    expect(res!.status).toBe(200)
    expect(m.update.mock.calls[0][0].data.champs).toEqual({ proc: 'PR-2', interne: 'secret' })
    expect((await res!.json()).champs).toEqual({ proc: 'PR-2' })
  })
  it('sans clé champs dans le corps : champs non touchés', async () => {
    m.cFind.mockResolvedValue({ id: 'c1', organizationId: 'o1', champs: { proc: 'PR-1' } })
    await PATCH(new NextRequest('http://x', { method: 'PATCH', body: JSON.stringify({ intitule: 'Nouveau' }) }), { params: Promise.resolve({ id: 'c1' }) })
    expect('champs' in m.update.mock.calls[0][0].data).toBe(false)
  })
})
