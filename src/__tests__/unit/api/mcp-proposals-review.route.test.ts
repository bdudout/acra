/**
 * Validation d'une proposition MCP (PATCH /api/mcp-proposals/[id]).
 * L'acceptation applique le RBAC de l'analyse cible (rôle EFFECTIF, F01) :
 * - un éditeur peut accepter → crée le risque réel + marque ACCEPTEE ;
 * - un rejet marque REJETEE sans créer de risque ;
 * - un non-éditeur (LECTEUR effectif) → 403, aucune écriture ;
 * - une proposition déjà traitée → 409.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'

const sessionRole = { value: 'ADMIN' }
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'reviewer', role: sessionRole.value } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const proposalFindUnique = vi.fn()
const analyseFindFirst = vi.fn()
const proposalUpdate = vi.fn(async (..._a: unknown[]) => ({}))
const risqueCreate = vi.fn(async (..._a: unknown[]) => ({ id: 'risk-new' }))
const mesureCreate = vi.fn(async (..._a: unknown[]) => ({ id: 'mesure-new' }))
// Accès typé au 1er argument d'un appel de mock (Prisma { where?, data }).
const argOf = (fn: { mock: { calls: unknown[][] } }, i = 0) => fn.mock.calls[i][0] as { where?: unknown; data: Record<string, unknown> }
vi.mock('@/lib/prisma', () => ({
  prisma: {
    mcpProposal: { findUnique: (...a: unknown[]) => proposalFindUnique(...a), update: (...a: unknown[]) => proposalUpdate(...a) },
    analyse: { findFirst: (...a: unknown[]) => analyseFindFirst(...a) },
    risque: { create: (...a: unknown[]) => risqueCreate(...a) },
    mesure: { create: (...a: unknown[]) => mesureCreate(...a) },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({ risque: { create: risqueCreate }, mesure: { create: mesureCreate }, mcpProposal: { update: proposalUpdate } })),
  },
}))
const effRole = { value: 'ADMIN' as string | null }
vi.mock('@/lib/org-context.server', () => ({
  analyseAccessWhere: vi.fn(async () => ({})),
  getEffectiveRoleForOrg: vi.fn(async () => effRole.value),
}))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn(() => '') }))

import { PATCH } from '@/app/api/mcp-proposals/[id]/route'

const PENDING = { id: 'p1', statut: 'EN_ATTENTE', type: 'risk', targetType: 'ANALYSE', targetId: 'an1', organizationId: 'orgA', payload: { nom: 'Rançongiciel', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE' } }
const ANALYSE = { id: 'an1', userId: 'owner', organizationId: 'orgA', deletedAt: null, accesUtilisateurs: [] }
const req = (body: unknown) => ({ json: async () => body }) as never
const params = { params: Promise.resolve({ id: 'p1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  sessionRole.value = 'ADMIN'; effRole.value = 'ADMIN'
  proposalFindUnique.mockResolvedValue({ ...PENDING })
  analyseFindFirst.mockResolvedValue({ ...ANALYSE })
})

describe('PATCH /api/mcp-proposals/[id]', () => {
  it('accept par un éditeur → crée le risque et marque ACCEPTEE', async () => {
    const res = await PATCH(req({ action: 'accept' }), params)
    expect(res.status).toBe(200)
    expect(risqueCreate).toHaveBeenCalledTimes(1)
    expect(argOf(risqueCreate).data).toMatchObject({ analyseId: 'an1', nom: 'Rançongiciel', niveauRisque: 12 })
    expect(argOf(proposalUpdate).data).toMatchObject({ statut: 'ACCEPTEE', appliedId: 'risk-new', reviewedById: 'reviewer' })
  })

  it('accept d\'une proposition "measure" → crée la mesure et marque ACCEPTEE', async () => {
    proposalFindUnique.mockResolvedValue({ ...PENDING, type: 'measure', payload: { nom: 'MFA', type: 'TECHNIQUE', priorite: 1, statut: 'A_FAIRE' } })
    const res = await PATCH(req({ action: 'accept' }), params)
    expect(res.status).toBe(200)
    expect(mesureCreate).toHaveBeenCalledTimes(1)
    expect(argOf(mesureCreate).data).toMatchObject({ analyseId: 'an1', nom: 'MFA', type: 'TECHNIQUE' })
    expect(risqueCreate).not.toHaveBeenCalled()
    expect(argOf(proposalUpdate).data).toMatchObject({ statut: 'ACCEPTEE', appliedId: 'mesure-new' })
  })

  it('reject → marque REJETEE sans créer de risque', async () => {
    const res = await PATCH(req({ action: 'reject', note: 'hors périmètre' }), params)
    expect(res.status).toBe(200)
    expect(risqueCreate).not.toHaveBeenCalled()
    expect(argOf(proposalUpdate).data).toMatchObject({ statut: 'REJETEE', reviewNote: 'hors périmètre' })
  })

  it('non-éditeur (LECTEUR effectif) → 403, aucune écriture', async () => {
    effRole.value = 'LECTEUR'
    const res = await PATCH(req({ action: 'accept' }), params)
    expect(res.status).toBe(403)
    expect(risqueCreate).not.toHaveBeenCalled()
    expect(proposalUpdate).not.toHaveBeenCalled()
  })

  it('proposition déjà traitée → 409', async () => {
    proposalFindUnique.mockResolvedValue({ ...PENDING, statut: 'ACCEPTEE' })
    const res = await PATCH(req({ action: 'accept' }), params)
    expect(res.status).toBe(409)
    expect(risqueCreate).not.toHaveBeenCalled()
  })

  it('action invalide → 400', async () => {
    const res = await PATCH(req({ action: 'delete' }), params)
    expect(res.status).toBe(400)
  })

  it('type d\'ancre non encore supporté (ex. RISQUE) → 400, sans écriture', async () => {
    proposalFindUnique.mockResolvedValue({ ...PENDING, targetType: 'RISQUE' })
    const res = await PATCH(req({ action: 'accept' }), params)
    expect(res.status).toBe(400)
    expect(risqueCreate).not.toHaveBeenCalled()
    expect(mesureCreate).not.toHaveBeenCalled()
  })
})
