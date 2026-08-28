import { describe, it, expect, vi, beforeEach } from 'vitest'

// Garde-fou d'intégration (#130/#131) : l'approbation d'analyse doit gater sur le rôle
// EFFECTIF d'org, pas le rôle d'instance. Un instance=RISK_MANAGER membre LECTEUR d'une
// org ne doit PAS pouvoir approuver une analyse de cette org.

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { analyse: { findFirst: vi.fn(), update: vi.fn() } } }))
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
