/** Import d'incidents en masse : CSV (session) et API v1 (clé, scope write). */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), config: vi.fn(), create: vi.fn(), audit: vi.fn(), rl: vi.fn(), auth: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))
vi.mock('@/lib/incident-import.server', () => ({ creerIncidentsEnMasse: m.create }))
vi.mock('@/lib/logger', () => ({ auditLog: m.audit, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rl, LIMIT_API_WRITE: { limit: 30, windowMs: 60000 } }))
vi.mock('@/lib/api-auth.server', () => ({ authenticateApiRequest: m.auth }))

import { POST as POST_CSV } from '@/app/api/incidents/import/route'
import { POST as POST_V1 } from '@/app/api/v1/incidents/route'

const json = (url: string, body: unknown) => new NextRequest(`http://x${url}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
  m.config.mockResolvedValue({ incidentsActive: true, secondeLigneActive: true, incidentsConfig: {}, champsPersonnalises: {} })
  m.create.mockImplementation(async (_o: string, _u: string, v: unknown[]) => v.length)
  m.rl.mockResolvedValue({ allowed: true, remaining: 5, resetAt: 0 })
  m.auth.mockResolvedValue({ ok: true, organizationId: 'o1', scopes: ['write'], keyId: 'k1', actorUserId: 'u9' })
})

describe('POST /api/incidents/import (CSV)', () => {
  it('importe les lignes valides et remonte les erreurs par ligne', async () => {
    const res = await POST_CSV(json('/api/incidents/import', { csv: 'intitule;dateSurvenance\nA;2026-01-01\n;2026-01-01\nC;nope' }))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j).toMatchObject({ crees: 1, erreurs: [{ ligne: 3, error: 'intitule_requis' }, { ligne: 4, error: 'date_invalide' }] })
    expect(m.create).toHaveBeenCalledWith('o1', 'u1', expect.any(Array))
    expect(m.audit).toHaveBeenCalled()
  })
  it('réservé à la 2ᵉ ligne (403), module inactif (403), CSV absent/trop gros/sans colonne intitulé (400), débit (429)', async () => {
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'LECTEUR' })
    expect((await POST_CSV(json('/api/incidents/import', { csv: 'intitule\nA' }))).status).toBe(403)
    m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'RSSI' })
    m.config.mockResolvedValue({ incidentsActive: false })
    expect((await POST_CSV(json('/api/incidents/import', { csv: 'intitule\nA' }))).status).toBe(403)
    m.config.mockResolvedValue({ incidentsActive: true, secondeLigneActive: true, incidentsConfig: {}, champsPersonnalises: {} })
    expect((await POST_CSV(json('/api/incidents/import', {}))).status).toBe(400)
    expect((await POST_CSV(json('/api/incidents/import', { csv: 'x'.repeat(2_000_000) }))).status).toBe(413)
    expect((await POST_CSV(json('/api/incidents/import', { csv: 'a;b\n1;2' }))).status).toBe(400)
    m.rl.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0 })
    expect((await POST_CSV(json('/api/incidents/import', { csv: 'intitule\nA' }))).status).toBe(429)
  })
})

describe('POST /api/v1/incidents (API, scope write)', () => {
  it('crée les incidents valides, déclarant = créateur de la clé', async () => {
    const res = await POST_V1(json('/api/v1/incidents', { incidents: [{ intitule: 'Panne SI', dateSurvenance: '2026-02-01', montantBrut: 1200 }, { intitule: '' }] }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ crees: 1, erreurs: [{ index: 1, error: 'intitule_requis' }] })
    expect(m.create).toHaveBeenCalledWith('o1', 'u9', expect.any(Array))
  })
  it('clé sans créateur refusée ; scope insuffisant relayé ; tableau absent ou trop long → 400', async () => {
    m.auth.mockResolvedValue({ ok: true, organizationId: 'o1', scopes: ['write'], keyId: 'k1', actorUserId: null })
    expect((await POST_V1(json('/api/v1/incidents', { incidents: [{ intitule: 'A' }] }))).status).toBe(400)
    m.auth.mockResolvedValue({ ok: false, status: 403, error: 'scope' })
    expect((await POST_V1(json('/api/v1/incidents', { incidents: [] }))).status).toBe(403)
    m.auth.mockResolvedValue({ ok: true, organizationId: 'o1', scopes: ['write'], keyId: 'k1', actorUserId: 'u9' })
    expect((await POST_V1(json('/api/v1/incidents', {}))).status).toBe(400)
    expect((await POST_V1(json('/api/v1/incidents', { incidents: Array.from({ length: 501 }, () => ({ intitule: 'x' })) }))).status).toBe(400)
  })
})
