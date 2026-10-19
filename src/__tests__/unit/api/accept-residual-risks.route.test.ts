import { describe, it, expect, vi, beforeEach } from 'vitest'

// Garde-fou d'intégration du RBAC analyse-lifecycle (#130/#131) : la route doit gater
// sur le rôle EFFECTIF d'org (getEffectiveRoleForOrg) et NON sur le rôle d'instance
// (session.user.role). Si un jour la route repasse au rôle d'instance, ces tests cassent.

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { analyse: { findFirst: vi.fn(), update: vi.fn() }, risque: { findMany: vi.fn() } } }))
vi.mock('@/lib/org-context.server', () => ({
  analyseAccessWhere: vi.fn(async () => ({})),
  getEffectiveRoleForOrg: vi.fn(),
}))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ acceptationRisquesActive: true })) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(async () => {}), getClientIp: vi.fn(() => '') }))

import { POST } from '@/app/api/analyses/[id]/accept-residual-risks/route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveRoleForOrg } from '@/lib/org-context.server'

const setSession = (role: string) =>
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1', role } } as never)
const req = (body: unknown) => ({ json: async () => body }) as never
const params = { params: Promise.resolve({ id: 'a1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.analyse.findFirst).mockResolvedValue({
    id: 'a1', nom: 'A', organizationId: 'orgX', deletedAt: null, statut: 'SOUMIS', risquesResiduelsStatut: 'EN_ATTENTE',
  } as never)
  vi.mocked(prisma.risque.findMany).mockResolvedValue([{ niveauResiduel: 4 }] as never)
  vi.mocked(prisma.analyse.update).mockResolvedValue({
    id: 'a1', risquesResiduelsStatut: 'ACCEPTES', risquesResiduelsPar: 'u1', risquesResiduelsLe: new Date(), risquesResiduelsCommentaire: null,
  } as never)
})

describe('POST /api/analyses/[id]/accept-residual-risks — RBAC rôle effectif d\'org (#130/#131)', () => {
  it('BYPASS FERMÉ : instance=DIRECTION_METIER mais membre LECTEUR de l\'org → 403', async () => {
    setSession('DIRECTION_METIER')
    vi.mocked(getEffectiveRoleForOrg).mockResolvedValue('LECTEUR')
    const res = await POST(req({ action: 'ACCEPTER' }), params)
    expect(res.status).toBe(403) // si la route regate sur l'instance (DIRECTION_METIER) → 200 → test casse
    expect(prisma.analyse.update).not.toHaveBeenCalled()
  })

  it('MEMBRE LÉGITIME : instance=ANALYSTE mais membre DIRECTION_METIER de l\'org → 200', async () => {
    setSession('ANALYSTE')
    vi.mocked(getEffectiveRoleForOrg).mockResolvedValue('DIRECTION_METIER')
    const res = await POST(req({ action: 'ACCEPTER' }), params)
    expect(res.status).toBe(200)
    expect(prisma.analyse.update).toHaveBeenCalledOnce()
  })

  it('cohérence : membre LECTEUR (instance LECTEUR aussi) → 403', async () => {
    setSession('LECTEUR')
    vi.mocked(getEffectiveRoleForOrg).mockResolvedValue('LECTEUR')
    const res = await POST(req({ action: 'ACCEPTER' }), params)
    expect(res.status).toBe(403)
  })
})

// Recette n° 56 : acceptation (ou refus) seulement sur une analyse soumise / approuvée dont
// tous les risques résiduels sont cotés ; code d'erreur stable, traduit côté interface.
describe('POST /api/analyses/[id]/accept-residual-risks — préconditions (n° 56)', () => {
  beforeEach(() => {
    setSession('DIRECTION_METIER')
    vi.mocked(getEffectiveRoleForOrg).mockResolvedValue('DIRECTION_METIER')
  })
  const analyseEn = (statut: string) => vi.mocked(prisma.analyse.findFirst).mockResolvedValue({
    id: 'a1', nom: 'A', organizationId: 'orgX', deletedAt: null, statut, risquesResiduelsStatut: 'EN_ATTENTE',
  } as never)

  it('analyse EN_COURS → 400 ANALYSE_NON_SOUMISE (ACCEPTER et REFUSER)', async () => {
    analyseEn('EN_COURS')
    for (const action of ['ACCEPTER', 'REFUSER']) {
      const res = await POST(req({ action, commentaire: 'motif' }), params)
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe('ANALYSE_NON_SOUMISE')
    }
    expect(prisma.analyse.update).not.toHaveBeenCalled()
  })

  it('risque non coté → 400 RISQUES_NON_COTES', async () => {
    analyseEn('APPROUVE')
    vi.mocked(prisma.risque.findMany).mockResolvedValue([{ niveauResiduel: 4 }, { niveauResiduel: null }] as never)
    const res = await POST(req({ action: 'ACCEPTER' }), params)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('RISQUES_NON_COTES')
    expect(prisma.analyse.update).not.toHaveBeenCalled()
  })

  it('analyse APPROUVE, risques cotés → 200', async () => {
    analyseEn('APPROUVE')
    const res = await POST(req({ action: 'ACCEPTER' }), params)
    expect(res.status).toBe(200)
  })

  it('RÉINITIALISER reste possible quel que soit l\'état', async () => {
    analyseEn('EN_COURS')
    vi.mocked(prisma.analyse.update).mockResolvedValue({ id: 'a1', risquesResiduelsStatut: 'EN_ATTENTE' } as never)
    const res = await POST(req({ action: 'REINITIALISER' }), params)
    expect(res.status).toBe(200)
  })
})
