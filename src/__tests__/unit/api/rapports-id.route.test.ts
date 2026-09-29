/** /api/rapports/[id] : lecture, cycle de validation (quatre-yeux), régénération, suppression. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), config: vi.fn(), find: vi.fn(), update: vi.fn(), del: vi.fn(), gen: vi.fn(), audit: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { rapportEdition: { findFirst: m.find, update: m.update, delete: m.del } } }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))
vi.mock('@/lib/rapports.server', () => ({ genererContenuRapport: m.gen }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))

import { GET, PATCH, DELETE } from '@/app/api/rapports/[id]/route'

const params = { params: Promise.resolve({ id: 'e1' }) }
const patch = (body: unknown) => new NextRequest('http://x/api/rapports/e1', { method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const edition = (o = {}) => ({ id: 'e1', organizationId: 'o1', code: 'R-INC-1', statut: 'BROUILLON', createdById: 'u1', periodeDebut: new Date('2026-09-01'), periodeFin: new Date('2026-09-30'), langue: 'fr', contenu: { sections: [] }, destinataires: [], ...o })

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u2', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
  m.config.mockResolvedValue({ incidentsActive: true, secondeLigneActive: true })
  m.find.mockResolvedValue(edition())
  m.update.mockImplementation(async (a: { data: object }) => ({ ...edition(), ...a.data }))
  m.gen.mockResolvedValue({ sections: [{ id: 'nouveau', blocs: [] }] })
})

describe('GET', () => {
  it('404 hors organisation active (pas de divulgation) ; contenu renvoyé sinon', async () => {
    m.find.mockResolvedValue(null)
    expect((await GET(new Request('http://x'), params)).status).toBe(404)
    m.find.mockResolvedValue(edition())
    const j = await (await GET(new Request('http://x'), params)).json()
    expect(j.contenu).toEqual({ sections: [] })
    expect(m.find.mock.calls[0][0].where).toMatchObject({ id: 'e1', organizationId: 'o1' })
  })
})

describe('PATCH — cycle de validation', () => {
  it('relire par une autre personne : brouillon → relu, horodaté', async () => {
    const res = await PATCH(patch({ action: 'RELU' }), params)
    expect(res.status).toBe(200)
    expect(m.update.mock.calls[0][0].data).toMatchObject({ statut: 'RELU', releuPar: 'u2' })
  })
  it('quatre-yeux : le créateur ne peut pas relire son édition (403 avec code)', async () => {
    m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
    const res = await PATCH(patch({ action: 'RELU' }), params)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('quatre_yeux')
    expect(m.update).not.toHaveBeenCalled()
  })
  it('valider fige (validePar, valideLe) ; diffuser consigne les destinataires', async () => {
    m.find.mockResolvedValue(edition({ statut: 'RELU' }))
    await PATCH(patch({ action: 'VALIDE' }), params)
    expect(m.update.mock.calls[0][0].data).toMatchObject({ statut: 'VALIDE', validePar: 'u2' })
    m.find.mockResolvedValue(edition({ statut: 'VALIDE' }))
    await PATCH(patch({ action: 'DIFFUSE', destinataires: ['Comité des risques', ' Direction générale ', 42] }), params)
    expect(m.update.mock.calls[1][0].data).toMatchObject({ statut: 'DIFFUSE', destinataires: [{ nom: 'Comité des risques' }, { nom: 'Direction générale' }] })
  })
  it('mode ligne unique : validation directe permise', async () => {
    m.config.mockResolvedValue({ incidentsActive: true, secondeLigneActive: false })
    m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
    const res = await PATCH(patch({ action: 'VALIDE' }), params)
    expect(res.status).toBe(200)
  })
  it('régénérer : seulement un brouillon, contenu recalculé ; une édition figée refuse', async () => {
    await PATCH(patch({ action: 'REGENERER' }), params)
    expect(m.gen).toHaveBeenCalled()
    expect(m.update.mock.calls[0][0].data.contenu).toEqual({ sections: [{ id: 'nouveau', blocs: [] }] })
    m.find.mockResolvedValue(edition({ statut: 'VALIDE' }))
    const res = await PATCH(patch({ action: 'REGENERER' }), params)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('non_regenerable')
  })
  it('rôle sans écriture : 403 ; action inconnue : 400', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'DIRECTION_METIER' })
    expect((await PATCH(patch({ action: 'RELU' }), params)).status).toBe(403)
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
    expect((await PATCH(patch({ action: 'XXX' }), params)).status).toBe(400)
  })
})

describe('DELETE', () => {
  it('supprime un brouillon ; refuse une édition relue, validée ou diffusée', async () => {
    expect((await DELETE(new Request('http://x', { method: 'DELETE' }), params)).status).toBe(200)
    expect(m.del).toHaveBeenCalled()
    m.find.mockResolvedValue(edition({ statut: 'VALIDE' }))
    const res = await DELETE(new Request('http://x', { method: 'DELETE' }), params)
    expect(res.status).toBe(400)
  })
})
