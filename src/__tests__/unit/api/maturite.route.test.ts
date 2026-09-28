/**
 * Maturité : /api/maturite (GET/PUT), /actions (écart → action CONFORMITE,
 * anti-doublon commun avec la conformité) et /export (CSV). Module inactif → 404 ;
 * écriture réservée aux rôles d'évaluation ; la couche maturité n'écrit JAMAIS
 * les évaluations de conformité (`entries`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ role: 'RSSI', active: true, orgId: 'org1' as string | null }))
const db = vi.hoisted(() => ({
  conformite: { findUnique: vi.fn(), upsert: vi.fn() },
  planAction: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  organization: { findUnique: vi.fn() },
}))
const auditLog = vi.hoisted(() => vi.fn())

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: vi.fn(async () => ({ role: state.role, activeOrgId: state.orgId })) }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ profilsOperationnelsActive: state.active, echelleMaturite: [] })) }))
vi.mock('@/lib/referentiel.server', () => ({
  listReferentiels: vi.fn(async () => [
    { code: 'NCSC_CAF', nom: 'NCSC CAF', version: 'v4.0', actif: true },
    { code: 'OFF', nom: 'Désactivé', version: null, actif: false },
  ]),
  getExigencesFor: vi.fn(async () => [
    { ref: 'A1', nom: 'Governance', description: 'g', categorie: 'A', type: 'ORGANISATIONNELLE' },
    { ref: 'A2', nom: 'Risk Management', description: 'r', categorie: 'A', type: 'ORGANISATIONNELLE' },
  ]),
}))
vi.mock('@/lib/i18n', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { getServerT: async () => fr, getServerLocale: async () => 'fr' }
})
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => auditLog(...a), getClientIp: () => '' }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { GET, PUT } from '@/app/api/maturite/route'
import { POST } from '@/app/api/maturite/actions/route'
import { GET as EXPORT } from '@/app/api/maturite/export/route'

const url = (path: string) => new URL(`http://x${path}`)
const getReq = (q = '') => ({ nextUrl: url(`/api/maturite${q}`), headers: new Headers() }) as never
const req = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as never

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(state, { role: 'RSSI', active: true, orgId: 'org1' })
  db.conformite.findUnique.mockResolvedValue({ id: 'c1', entries: [{ ref: 'A1', statut: 'partiel' }], maturites: { A1: { actuel: 1 } }, maturiteCible: 3, updatedAt: new Date() })
  db.planAction.findMany.mockResolvedValue([])
  db.conformite.upsert.mockImplementation(async (a: { update: { maturites: unknown; maturiteCible?: number } }) => ({ id: 'c1', maturites: a.update.maturites, maturiteCible: a.update.maturiteCible ?? 3, updatedAt: new Date() }))
})

describe('/api/maturite', () => {
  it('module inactif ou sans org active → 404 partout, sans lecture', async () => {
    state.active = false
    expect((await GET(getReq())).status).toBe(404)
    expect((await PUT(req({ referentiel: 'NCSC_CAF' }))).status).toBe(404)
    expect((await POST(req({ referentiel: 'NCSC_CAF', ref: 'A1' }))).status).toBe(404)
    expect((await EXPORT(({ nextUrl: url('/api/maturite/export?referentiel=NCSC_CAF'), headers: new Headers() }) as never)).status).toBe(404)
    state.active = true; state.orgId = null
    expect((await GET(getReq())).status).toBe(404)
    expect(db.conformite.findUnique).not.toHaveBeenCalled()
  })

  it('GET : lecture pour un LECTEUR, profil + conformité du même point, référentiel inactif refusé', async () => {
    state.role = 'LECTEUR'
    const res = await GET(getReq('?referentiel=NCSC_CAF'))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.canManage).toBe(false)
    expect(d.profile.maturites.A1).toEqual({ actuel: 1 })
    expect(d.profile.conformite.A1).toBe('partiel')
    expect(d.profile.stats.belowTarget).toBe(1)
    expect(d.scale).toHaveLength(6)
    expect((await GET(getReq('?referentiel=OFF'))).status).toBe(400)
  })

  it('PUT refusé aux rôles sans droit d’évaluation (403)', async () => {
    for (const r of ['LECTEUR', 'AUDITEUR', 'ANALYSTE']) {
      state.role = r
      expect((await PUT(req({ referentiel: 'NCSC_CAF', maturites: { A1: { actuel: 2 } } }))).status).toBe(403)
    }
    expect(db.conformite.upsert).not.toHaveBeenCalled()
  })

  it('PUT : écrit seulement la couche maturité (jamais entries), horodatage serveur, diff journalisé', async () => {
    const res = await PUT(req({ referentiel: 'NCSC_CAF', maturiteCible: 4, maturites: { A1: { actuel: 2, updatedById: 'pirate' }, ZZ: { actuel: 5 } } }))
    expect(res.status).toBe(200)
    const arg = db.conformite.upsert.mock.calls[0][0]
    expect(arg.where).toEqual({ organizationId_referentiel_entite: { organizationId: 'org1', referentiel: 'NCSC_CAF', entite: '' } })
    expect(arg.update).not.toHaveProperty('entries')
    expect(arg.update.maturiteCible).toBe(4)
    expect(arg.update.maturites.A1).toMatchObject({ actuel: 2, updatedById: 'u1' })
    expect(arg.update.maturites.ZZ).toBeUndefined()
    const [action, ctx] = auditLog.mock.calls[0]
    expect(action).toBe('MATURITY_UPDATED')
    expect(ctx.details.changes).toEqual([{ ref: 'A1', fields: { actuel: [1, 2] } }])
    expect(ctx.details.maturiteCible).toEqual([3, 4])
  })

  it('PUT : niveau cible hors 0–5 ou référentiel inconnu → 400', async () => {
    expect((await PUT(req({ referentiel: 'NCSC_CAF', maturiteCible: 6 }))).status).toBe(400)
    expect((await PUT(req({ referentiel: 'FOO' }))).status).toBe(400)
  })
})

describe('/api/maturite/actions', () => {
  it('crée une action liée au point par un lien CONFORMITE (même objet que la conformité)', async () => {
    db.planAction.findFirst.mockResolvedValue(null)
    db.planAction.create.mockResolvedValue({ id: 'a1', titre: 't', statut: 'A_FAIRE' })
    const res = await POST(req({ referentiel: 'NCSC_CAF', ref: 'A1' }))
    expect(res.status).toBe(201)
    const data = db.planAction.create.mock.calls[0][0].data
    expect(data.titre).toBe('A1 Governance — porter la maturité de 1 à 3')
    expect(data.liens.create[0]).toMatchObject({ type: 'CONFORMITE', targetId: 'NCSC_CAF', ref: 'A1' })
  })

  it('anti-doublon : une action ouverte existante (même d’origine conformité) est renvoyée', async () => {
    db.planAction.findFirst.mockResolvedValue({ id: 'a0', titre: 't', statut: 'EN_COURS' })
    const res = await POST(req({ referentiel: 'NCSC_CAF', ref: 'A1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).existing).toBe(true)
    expect(db.planAction.create).not.toHaveBeenCalled()
    expect(db.planAction.findFirst.mock.calls[0][0].where).toMatchObject({ organizationId: 'org1', statut: { not: 'FAIT' }, liens: { some: { type: 'CONFORMITE', targetId: 'NCSC_CAF', ref: 'A1' } } })
  })

  it('point sans écart → 400 ; rôle sans droit → 403', async () => {
    expect((await POST(req({ referentiel: 'NCSC_CAF', ref: 'A2' }))).status).toBe(400)
    state.role = 'LECTEUR'
    expect((await POST(req({ referentiel: 'NCSC_CAF', ref: 'A1' }))).status).toBe(403)
    expect(db.planAction.create).not.toHaveBeenCalled()
  })
})

describe('/api/maturite/export', () => {
  it('CSV complet, formules neutralisées, export journalisé', async () => {
    db.conformite.findUnique.mockResolvedValue({ id: 'c1', entries: [], maturites: { A1: { actuel: 1, commentaire: '=HYPERLINK("x")' } }, maturiteCible: 3, updatedAt: new Date() })
    db.organization.findUnique.mockResolvedValue({ nom: 'Acme', slug: 'acme' })
    state.role = 'AUDITEUR'
    const res = await EXPORT(({ nextUrl: url('/api/maturite/export?referentiel=NCSC_CAF'), headers: new Headers() }) as never)
    expect(res.status).toBe(200)
    const csv = await res.text()
    expect(csv).toContain('3 — Défini')
    expect(csv).toContain('1 — Initial')
    expect(csv).not.toMatch(/(^|,)"?=HYPERLINK/m)
    expect(auditLog).toHaveBeenCalledWith('EXPORT', expect.objectContaining({ targetType: 'maturite' }))
  })
})
