import { describe, it, expect, vi, beforeEach } from 'vitest'

// Garde-fou d'intégration (#130/#131) : l'approbation d'analyse doit gater sur le rôle
// EFFECTIF d'org, pas le rôle d'instance. Un instance=RISK_MANAGER membre LECTEUR d'une
// org ne doit PAS pouvoir approuver une analyse de cette org.

// Petite structure non activée (option de structure lue par les règles de droits).
vi.mock('@/lib/org-config.server', async (orig) => ({ ...(await orig<typeof import('@/lib/org-config.server')>()), optionsStructure: vi.fn(async () => ({ petiteStructure: false })) }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => {
  const prisma: Record<string, unknown> = { analyse: { findFirst: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() }, $queryRaw: vi.fn(async () => []) }
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma))
  return { prisma }
})
vi.mock('@/lib/org-context.server', () => ({
  analyseAccessWhere: vi.fn(async () => ({})),
  countOrgMembers: vi.fn(async () => 3),
  getEffectiveRoleForOrg: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(async () => {}), getClientIp: vi.fn(() => '') }))

import { POST } from '@/app/api/analyses/[id]/approbation/route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveRoleForOrg } from '@/lib/org-context.server'

const setSession = (role: string) =>
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'approbateur', role } } as never)
const req = (body: unknown) => ({ json: async () => body }) as never
const params = { params: Promise.resolve({ id: 'a1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  // Analyse SOUMISE, appartenant à un AUTRE utilisateur (donc pas d'exclusion propriétaire #120).
  vi.mocked(prisma.analyse.findFirst).mockResolvedValue({
    id: 'a1', nom: 'A', statut: 'SOUMIS', userId: 'auteur', organizationId: 'orgX',
    deletedAt: null, accesUtilisateurs: [],
  } as never)
  vi.mocked(prisma.analyse.update).mockResolvedValue({ id: 'a1', statut: 'APPROUVE' } as never)
})

describe('POST /api/analyses/[id]/approbation APPROUVER — RBAC rôle effectif d\'org (#130/#131)', () => {
  it('BYPASS FERMÉ : instance=RISK_MANAGER mais membre LECTEUR de l\'org → 403', async () => {
    setSession('RISK_MANAGER')
    vi.mocked(getEffectiveRoleForOrg).mockResolvedValue('LECTEUR')
    const res = await POST(req({ action: 'APPROUVER' }), params)
    expect(res.status).toBe(403) // si regate sur l'instance (RISK_MANAGER) → 200 → test casse
    expect(prisma.analyse.update).not.toHaveBeenCalled()
  })

  it('MEMBRE LÉGITIME : instance=ANALYSTE mais membre RISK_MANAGER de l\'org → 200', async () => {
    setSession('ANALYSTE')
    vi.mocked(getEffectiveRoleForOrg).mockResolvedValue('RISK_MANAGER')
    const res = await POST(req({ action: 'APPROUVER' }), params)
    expect(res.status).toBe(200)
    expect(prisma.analyse.update).toHaveBeenCalledOnce()
  })
})

describe('APPROUVER — analyse projet 360 : RSSI ET Risk Manager', () => {
  const analyse360 = (approbations: unknown[] = []) => vi.mocked(prisma.analyse.findFirst).mockResolvedValue({
    id: 'a1', nom: 'P', statut: 'SOUMIS', userId: 'auteur', organizationId: 'orgX', methode: 'PROJET_360',
    deletedAt: null, accesUtilisateurs: [], approbations,
  } as never) && vi.mocked(prisma.analyse.findUniqueOrThrow).mockResolvedValue({ statut: 'SOUMIS', approbations } as never)

  it('premier avis (RSSI) : enregistré, l’analyse reste soumise', async () => {
    analyse360()
    setSession('ANALYSTE'); vi.mocked(getEffectiveRoleForOrg).mockResolvedValue('RSSI')
    const res = await POST(req({ action: 'APPROUVER', commentaire: 'ok cyber' }), params)
    expect(res.status).toBe(200)
    const data = vi.mocked(prisma.analyse.update).mock.calls[0][0].data as Record<string, unknown>
    expect(data.statut).toBeUndefined()
    expect(data.approbations).toEqual([expect.objectContaining({ role: 'RSSI', userId: 'approbateur', commentaire: 'ok cyber' })])
  })

  it('second avis (Risk Manager, autre personne) : analyse approuvée', async () => {
    analyse360([{ role: 'RSSI', userId: 'rssi1', le: '2026-09-29T09:00:00.000Z' }])
    setSession('ANALYSTE'); vi.mocked(getEffectiveRoleForOrg).mockResolvedValue('RISK_MANAGER')
    const res = await POST(req({ action: 'APPROUVER' }), params)
    expect(res.status).toBe(200)
    const data = vi.mocked(prisma.analyse.update).mock.calls[0][0].data as Record<string, unknown>
    expect(data.statut).toBe('APPROUVE')
    expect((data.approbations as unknown[]).length).toBe(2)
  })

  it('T9 — l\'avis est appliqué sur la liste RELUE sous verrou, pas sur la lecture initiale', async () => {
    analyse360([]) // lecture initiale : aucun avis…
    // … mais un Risk Manager a approuvé entre-temps (lu sous verrou dans la transaction).
    vi.mocked(prisma.analyse.findUniqueOrThrow).mockResolvedValue({ statut: 'SOUMIS', approbations: [{ role: 'RISK_MANAGER', userId: 'rm1', le: '2026-09-29T09:00:00.000Z' }] } as never)
    setSession('ANALYSTE'); vi.mocked(getEffectiveRoleForOrg).mockResolvedValue('RSSI')
    const res = await POST(req({ action: 'APPROUVER' }), params)
    expect(res.status).toBe(200)
    expect(prisma.$queryRaw).toHaveBeenCalled()
    const data = vi.mocked(prisma.analyse.update).mock.calls[0][0].data as Record<string, unknown>
    expect(data.statut).toBe('APPROUVE') // les deux avis sont conservés
    expect((data.approbations as { role: string }[]).map(a => a.role).sort()).toEqual(['RISK_MANAGER', 'RSSI'])
  })

  it('deux RSSI ne suffisent pas : second avis du même rôle refusé (409)', async () => {
    analyse360([{ role: 'RSSI', userId: 'rssi1', le: '2026-09-29T09:00:00.000Z' }])
    setSession('ANALYSTE'); vi.mocked(getEffectiveRoleForOrg).mockResolvedValue('RSSI')
    const res = await POST(req({ action: 'APPROUVER' }), params)
    expect(res.status).toBe(409)
    expect(prisma.analyse.update).not.toHaveBeenCalled()
  })

  it('rejet : renvoie à l’auteur et efface les avis', async () => {
    analyse360([{ role: 'RSSI', userId: 'rssi1', le: '2026-09-29T09:00:00.000Z' }])
    setSession('ANALYSTE'); vi.mocked(getEffectiveRoleForOrg).mockResolvedValue('RISK_MANAGER')
    await POST(req({ action: 'REJETER', commentaire: 'budget non couvert' }), params)
    const data = vi.mocked(prisma.analyse.update).mock.calls[0][0].data as Record<string, unknown>
    expect(data).toMatchObject({ statut: 'REJETE', approbations: [] })
  })
})
