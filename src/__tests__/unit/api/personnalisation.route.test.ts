/** /api/personnalisation : vocabulaire, champs personnalisés, gabarits sectoriels. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), config: vi.fn(), upsert: vi.fn(), audit: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { organizationConfig: { upsert: m.upsert }, organization: { findUnique: vi.fn(async () => ({ secteursActivite: ['FINANCE'] })), update: vi.fn() } } }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))

import { GET, PUT } from '@/app/api/personnalisation/route'
import { POST as POST_GABARIT } from '@/app/api/personnalisation/gabarit/route'

const req = (url: string, method: string, body?: unknown) => new NextRequest(`http://x${url}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) })
const cfg = (o = {}) => ({
  registreRisquesActive: false, incidentsActive: false, controlePermanentActive: false, auditInterneActive: false, kriActive: false, reglementaireActive: false, secondeLigneActive: true,
  incidentsConfig: {}, vocabulaire: { incident: { '*': 'Événement' } },
  champsPersonnalises: { incident: [{ code: 'ticket', label: 'Ticket', type: 'TEXTE' }, { code: 'secret', label: 'Secret', type: 'TEXTE', roles: ['RSSI'] }] }, ...o,
})

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'ADMIN' })
  m.config.mockResolvedValue(cfg())
  m.upsert.mockResolvedValue({})
})

describe('GET', () => {
  it('401 sans session ; vocabulaire et champs accessibles au rôle pour tout utilisateur', async () => {
    m.session.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'ANALYSTE' })
    const j = await (await GET()).json()
    expect(j.vocabulaire.incident['*']).toBe('Événement')
    expect(j.champs.incident.map((c: { code: string }) => c.code)).toEqual(['ticket']) // « secret » réservé au RSSI
    expect(j.canEdit).toBe(false)
  })
  it('l’administrateur voit tous les champs et peut éditer', async () => {
    const j = await (await GET()).json()
    expect(j.champs.incident).toHaveLength(2)
    expect(j.canEdit).toBe(true)
  })
})

describe('PUT', () => {
  it('réservé à l’administrateur de l’organisation', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
    expect((await PUT(req('/api/personnalisation', 'PUT', { vocabulaire: {} }))).status).toBe(403)
    expect(m.upsert).not.toHaveBeenCalled()
  })
  it('nettoie et enregistre vocabulaire et champs, journalise', async () => {
    const res = await PUT(req('/api/personnalisation', 'PUT', { vocabulaire: { incident: { '*': ' Événement de sécurité ' }, bidon: { '*': 'x' } }, champsPersonnalises: { incident: [{ code: 'BAD CODE', label: 'x', type: 'TEXTE' }, { code: 'ok', label: 'Ok', type: 'TEXTE' }] } }))
    expect(res.status).toBe(200)
    const upd = m.upsert.mock.calls[0][0].update
    expect(upd.vocabulaire).toEqual({ incident: { '*': 'Événement de sécurité' } })
    expect(upd.champsPersonnalises.incident.map((c: { code: string }) => c.code)).toEqual(['ok'])
    expect(m.audit).toHaveBeenCalled()
  })
  it('ne touche que les blocs fournis', async () => {
    await PUT(req('/api/personnalisation', 'PUT', { vocabulaire: {} }))
    expect('champsPersonnalises' in m.upsert.mock.calls[0][0].update).toBe(false)
  })
})

describe('POST gabarit', () => {
  it('aperçu (dryRun) : liste les changements sans rien écrire', async () => {
    const res = await POST_GABARIT(req('/api/personnalisation/gabarit', 'POST', { id: 'PME', dryRun: true }))
    const j = await res.json()
    expect(j.changements.length).toBeGreaterThan(0)
    expect(m.upsert).not.toHaveBeenCalled()
  })
  it('application : modules, régimes de notification et vocabulaire écrits ; réservé à l’admin ; gabarit inconnu refusé', async () => {
    const res = await POST_GABARIT(req('/api/personnalisation/gabarit', 'POST', { id: 'SANTE' }))
    expect(res.status).toBe(200)
    const upd = m.upsert.mock.calls[0][0].update
    expect(upd).toMatchObject({ incidentsActive: true, controlePermanentActive: true, registreRisquesActive: true })
    expect(upd.incidentsConfig.regimes.find((r: { code: string }) => r.code === 'RGPD_33').actif).toBe(true)
    expect(upd.vocabulaire.incident).toEqual({ '*': 'Événement' }) // déjà personnalisé : conservé
    expect((await POST_GABARIT(req('/api/personnalisation/gabarit', 'POST', { id: 'NOPE' }))).status).toBe(400)
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
    expect((await POST_GABARIT(req('/api/personnalisation/gabarit', 'POST', { id: 'PME' }))).status).toBe(403)
  })
})
