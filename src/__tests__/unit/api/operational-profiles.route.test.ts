/**
 * Profils opérationnels US/UK : routes /api/operational-profiles (GET/PUT),
 * /actions (promotion anti-doublon) et /export (CSV). Module inactif → 404 ;
 * écriture réservée aux rôles d'évaluation ; horodatage non forgeable.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ role: 'RSSI', active: true, orgId: 'org1' as string | null }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: vi.fn(async () => ({ role: state.role, activeOrgId: state.orgId })) }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ profilsOperationnelsActive: state.active })) }))
vi.mock('@/lib/i18n', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { getServerT: async () => fr }
})
const auditLog = vi.hoisted(() => vi.fn())
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => auditLog(...a), getClientIp: () => '' }))

const db = vi.hoisted(() => ({
  operationalProfile: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
  planAction: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  organization: { findUnique: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { GET, PUT } from '@/app/api/operational-profiles/route'
import { POST } from '@/app/api/operational-profiles/actions/route'
import { GET as EXPORT } from '@/app/api/operational-profiles/export/route'

const req = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as never
const exportReq = (framework: string) => ({ nextUrl: new URL(`http://x/api/operational-profiles/export?framework=${framework}`), headers: new Headers() }) as never

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(state, { role: 'RSSI', active: true, orgId: 'org1' })
  db.operationalProfile.findMany.mockResolvedValue([])
  db.planAction.findMany.mockResolvedValue([])
  db.operationalProfile.upsert.mockImplementation(async (a: { create: { cible: string | null } }) => ({ id: 'p1', cible: a.create.cible, updatedAt: new Date() }))
})

describe('/api/operational-profiles', () => {
  it('module inactif (ou sans org active) → 404 sur toutes les routes, sans lecture', async () => {
    state.active = false
    expect((await GET()).status).toBe(404)
    expect((await PUT(req({ framework: 'NIST_CSF_2_0', entries: [] }))).status).toBe(404)
    expect((await POST(req({ framework: 'NIST_CSF_2_0', ref: 'GV.OC' }))).status).toBe(404)
    expect((await EXPORT(exportReq('NIST_CSF_2_0'))).status).toBe(404)
    state.active = true; state.orgId = null
    expect((await GET()).status).toBe(404)
    expect(db.operationalProfile.findMany).not.toHaveBeenCalled()
  })

  it('GET : lecture ouverte à un LECTEUR, profils vierges, canManage=false', async () => {
    state.role = 'LECTEUR'
    const res = await GET()
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.canManage).toBe(false)
    expect(d.profiles.map((p: { framework: string }) => p.framework)).toEqual(['NIST_CSF_2_0', 'NCSC_CAF_V4'])
    expect(d.profiles[0].stats.total).toBe(22)
    expect(d.profiles[0].entries).toEqual([])
  })

  it('PUT refusé aux rôles sans droit d’évaluation (403)', async () => {
    for (const r of ['LECTEUR', 'AUDITEUR', 'ANALYSTE']) {
      state.role = r
      expect((await PUT(req({ framework: 'NIST_CSF_2_0', entries: [] }))).status).toBe(403)
    }
    expect(db.operationalProfile.upsert).not.toHaveBeenCalled()
  })

  it('PUT : cadre ou niveau cible invalide → 400', async () => {
    expect((await PUT(req({ framework: 'FOO', entries: [] }))).status).toBe(400)
    expect((await PUT(req({ framework: 'NCSC_CAF_V4', cible: 'TIER_2' }))).status).toBe(400)
  })

  it('PUT : horodatage serveur (non forgeable), diff journalisé', async () => {
    db.operationalProfile.findUnique.mockResolvedValue({ entries: [{ ref: 'A1', statut: 'PARTIEL' }], cible: null })
    const res = await PUT(req({ framework: 'NCSC_CAF_V4', cible: 'ENHANCED', entries: [{ ref: 'A1', statut: 'COUVERT', updatedById: 'pirate', updatedAt: '2000-01-01T00:00:00.000Z' }] }))
    expect(res.status).toBe(200)
    const upsert = db.operationalProfile.upsert.mock.calls[0][0]
    const saved = upsert.update.entries[0]
    expect(saved.updatedById).toBe('u1')
    expect(saved.updatedAt).not.toBe('2000-01-01T00:00:00.000Z')
    expect(upsert.update.cible).toBe('ENHANCED')
    expect(upsert.where).toEqual({ organizationId_framework: { organizationId: 'org1', framework: 'NCSC_CAF_V4' } })
    const [action, ctx] = auditLog.mock.calls[0]
    expect(action).toBe('OPERATIONAL_PROFILE_UPDATED')
    expect(ctx.details.changes).toEqual([{ ref: 'A1', fields: { statut: ['PARTIEL', 'COUVERT'] } }])
    expect(ctx.details.cible).toEqual([null, 'ENHANCED'])
  })

  it('PUT sans changement sur un profil existant : aucune écriture', async () => {
    db.operationalProfile.findUnique.mockResolvedValue({ entries: [{ ref: 'A1', statut: 'COUVERT' }], cible: 'BASIC' })
    const res = await PUT(req({ framework: 'NCSC_CAF_V4', entries: [{ ref: 'A1', statut: 'COUVERT' }] }))
    expect((await res.json()).unchanged).toBe(true)
    expect(db.operationalProfile.upsert).not.toHaveBeenCalled()
  })
})

describe('/api/operational-profiles/actions', () => {
  beforeEach(() => {
    db.operationalProfile.findUnique.mockResolvedValue({ id: 'p1', entries: [{ ref: 'GV.OC', statut: 'NON_COUVERT', responsable: 'DSI' }, { ref: 'GV.RM', statut: 'COUVERT' }] })
  })

  it('crée une action liée au point (lien OPERATIONAL_PROFILE, ref = point)', async () => {
    db.planAction.findFirst.mockResolvedValue(null)
    db.planAction.create.mockResolvedValue({ id: 'a1', titre: 't', statut: 'A_FAIRE' })
    const res = await POST(req({ framework: 'NIST_CSF_2_0', ref: 'GV.OC' }))
    expect(res.status).toBe(201)
    const data = db.planAction.create.mock.calls[0][0].data
    expect(data.organizationId).toBe('org1')
    expect(data.porteur).toBe('DSI')
    expect(data.titre).toBe('GV.OC Organizational Context — combler l’écart')
    expect(data.liens.create[0]).toMatchObject({ type: 'OPERATIONAL_PROFILE', targetId: 'p1', ref: 'GV.OC' })
  })

  it('anti-doublon : une action ouverte existante est renvoyée, rien n’est créé', async () => {
    db.planAction.findFirst.mockResolvedValue({ id: 'a0', titre: 't', statut: 'EN_COURS' })
    const res = await POST(req({ framework: 'NIST_CSF_2_0', ref: 'GV.OC' }))
    expect(res.status).toBe(200)
    expect((await res.json()).existing).toBe(true)
    expect(db.planAction.create).not.toHaveBeenCalled()
    expect(db.planAction.findFirst.mock.calls[0][0].where).toMatchObject({ organizationId: 'org1', statut: { not: 'FAIT' } })
  })

  it('point couvert ou inconnu → 400 ; rôle sans droit → 403', async () => {
    expect((await POST(req({ framework: 'NIST_CSF_2_0', ref: 'GV.RM' }))).status).toBe(400)
    expect((await POST(req({ framework: 'NIST_CSF_2_0', ref: 'XX' }))).status).toBe(400)
    state.role = 'LECTEUR'
    expect((await POST(req({ framework: 'NIST_CSF_2_0', ref: 'GV.OC' }))).status).toBe(403)
    expect(db.planAction.create).not.toHaveBeenCalled()
  })
})

describe('/api/operational-profiles/export', () => {
  it('CSV complet, formules neutralisées, export journalisé', async () => {
    db.operationalProfile.findMany.mockResolvedValue([{ id: 'p2', framework: 'NCSC_CAF_V4', cible: 'BASIC', updatedAt: new Date(), entries: [{ ref: 'A1', statut: 'PARTIEL', commentaire: '=HYPERLINK("x")' }] }])
    db.organization.findUnique.mockResolvedValue({ nom: 'Acme', slug: 'acme' })
    state.role = 'AUDITEUR'
    const res = await EXPORT(exportReq('NCSC_CAF_V4'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    const csv = await res.text()
    expect(csv).toContain('Basic Profile')
    expect(csv).toContain('Partiellement couvert')
    expect(csv).not.toMatch(/(^|,)"?=HYPERLINK/m)
    expect(csv.split('\r\n').filter(l => /^"?[A-D]"?,/.test(l))).toHaveLength(14)
    expect(auditLog).toHaveBeenCalledWith('EXPORT', expect.objectContaining({ targetType: 'operational-profile' }))
  })

  it('cadre invalide → 400', async () => {
    expect((await EXPORT(exportReq('NOPE'))).status).toBe(400)
  })
})
