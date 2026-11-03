// @vitest-environment node
// Risques proposés (registre TIC, résilience) — /api/risk-items/propositions-tic : liste libellée de l'organisation
// active, validation (→ risque au registre) et écart ; RBAC = création au registre (LECTEUR refusé), modules requis,
// clé hors organisation ou déjà traitée → 404 sans divulgation.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { ZodType } from 'zod'
import { peutTraiterPropositionsRisquesTic, type UserRole } from '@/lib/permissions'

const m = vi.hoisted(() => ({
  role: 'RSSI' as string, config: { registreRisquesActive: true, reglementaireActive: true },
  ouvertes: vi.fn(), valider: vi.fn(), ecarter: vi.fn(),
}))
vi.mock('@/lib/with-access.server', () => ({
  withAccess: (opts: { allow?: (r: string) => boolean; body?: ZodType }, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
    async (req: NextRequest) => {
      if (opts.allow && !opts.allow(m.role)) return Response.json({ error: 'forbidden' }, { status: 403 })
      let body: unknown
      if (opts.body) {
        const r = opts.body.safeParse(await req.json().catch(() => null))
        if (!r.success) return Response.json({ error: 'invalid_body' }, { status: 400 })
        body = r.data
      }
      return handler(req, { user: { id: 'u1', role: m.role }, role: m.role, orgId: 'orgA', scope: null, params: {}, body, rl: null })
    },
}))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => m.config) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: () => '10.0.0.1' }))
vi.mock('@/lib/propositions-risques-tic.server', () => ({ propositionsOuvertesOrg: m.ouvertes, validerPropositionTic: m.valider, ecarterPropositionTic: m.ecarter }))

import { GET, POST } from '@/app/api/risk-items/propositions-tic/route'

const P = {
  cle: 'RTO_AU_DELA_TOLERANCE:p1', type: 'RTO_AU_DELA_TOLERANCE', famille: 'CONTINUITE_METIER_TIC', processusId: 'p1',
  origine: { type: 'PROCESSUS', id: 'p1', libelle: 'Paiements', lien: '/reglementaire' }, params: { fonction: 'Paiements' }, durees: { rto: 480, tolerance: 240 }, gravite: 4, vraisemblance: 3,
}
const get = () => GET(new NextRequest('http://x/api/risk-items/propositions-tic'))
const post = (body: unknown) => POST(new NextRequest('http://x/api/risk-items/propositions-tic', { method: 'POST', body: JSON.stringify(body) }))

beforeEach(() => {
  vi.clearAllMocks()
  m.role = 'RSSI'; m.config = { registreRisquesActive: true, reglementaireActive: true }
  m.ouvertes.mockResolvedValue([P])
  m.valider.mockResolvedValue({ ok: true, value: { id: 'r1', intitule: 'X' } })
  m.ecarter.mockResolvedValue({ ok: true, value: { cle: P.cle } })
})

describe('peutTraiterPropositionsRisquesTic', () => {
  it('gouvernance et lecture globale : oui ; LECTEUR, ANALYSTE, METIER : non', () => {
    const oui: UserRole[] = ['ADMIN', 'SUPER_ADMIN', 'RSSI', 'RISK_MANAGER', 'CONFORMITE', 'DPO', 'DIRECTION_METIER', 'CONTROLEUR', 'AUDITEUR']
    const non: UserRole[] = ['LECTEUR', 'ANALYSTE', 'METIER']
    for (const r of oui) expect(peutTraiterPropositionsRisquesTic(r)).toBe(true)
    for (const r of non) expect(peutTraiterPropositionsRisquesTic(r)).toBe(false)
  })
})

describe('GET /api/risk-items/propositions-tic', () => {
  it('propositions ouvertes de l’organisation active, libellées', async () => {
    const r = await get()
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(m.ouvertes).toHaveBeenCalledWith('orgA')
    expect(j.propositions).toHaveLength(1)
    expect(j.propositions[0]).toMatchObject({ cle: P.cle, famille: 'CONTINUITE_METIER_TIC', intitule: 'Reprise prévue au-delà de la tolérance d’impact — Paiements' })
    expect(j.propositions[0].description).toContain('8 h')
  })
  it('LECTEUR refusé (403)', async () => {
    m.role = 'LECTEUR'
    expect((await get()).status).toBe(403)
  })
  it('module réglementaire ou registre inactif : 403 module_inactive', async () => {
    m.config = { registreRisquesActive: true, reglementaireActive: false }
    const r = await get()
    expect(r.status).toBe(403)
    expect(await r.json()).toEqual({ error: 'module_inactive' })
    expect(m.ouvertes).not.toHaveBeenCalled()
  })
})

describe('POST /api/risk-items/propositions-tic', () => {
  it('VALIDER : crée le risque dans l’organisation active (201)', async () => {
    const r = await post({ cle: P.cle, action: 'VALIDER' })
    expect(r.status).toBe(201)
    expect(await r.json()).toEqual({ id: 'r1', intitule: 'X' })
    expect(m.valider).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'orgA', cle: P.cle, userId: 'u1', role: 'RSSI' }), expect.any(Object))
  })
  it('ECARTER : mémorise la clé (200)', async () => {
    const r = await post({ cle: P.cle, action: 'ECARTER' })
    expect(r.status).toBe(200)
    expect(m.ecarter).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'orgA', cle: P.cle }))
  })
  it('clé inconnue, d’une autre organisation ou déjà traitée : 404', async () => {
    m.valider.mockResolvedValue({ ok: false, status: 404 })
    expect((await post({ cle: 'CONTRAT_SANS_SORTIE:autre-org', action: 'VALIDER' })).status).toBe(404)
  })
  it('course (validée ou écartée entre-temps) : 409 conflict', async () => {
    m.valider.mockResolvedValue({ ok: false, status: 409 })
    const r = await post({ cle: P.cle, action: 'VALIDER' })
    expect(r.status).toBe(409)
    expect(await r.json()).toEqual({ error: 'conflict' })
    m.ecarter.mockResolvedValue({ ok: false, status: 409 })
    expect((await post({ cle: P.cle, action: 'ECARTER' })).status).toBe(409)
  })
  it('corps invalide (clé mal formée, action inconnue) : 400', async () => {
    expect((await post({ cle: 'INCONNU:x', action: 'VALIDER' })).status).toBe(400)
    expect((await post({ cle: P.cle, action: 'SUPPRIMER' })).status).toBe(400)
    expect(m.valider).not.toHaveBeenCalled()
  })
  it('LECTEUR refusé (403), rien n’est écrit', async () => {
    m.role = 'LECTEUR'
    expect((await post({ cle: P.cle, action: 'VALIDER' })).status).toBe(403)
    expect(m.valider).not.toHaveBeenCalled()
  })
  it('modules inactifs : 403', async () => {
    m.config = { registreRisquesActive: false, reglementaireActive: true }
    expect((await post({ cle: P.cle, action: 'ECARTER' })).status).toBe(403)
    expect(m.ecarter).not.toHaveBeenCalled()
  })
})
