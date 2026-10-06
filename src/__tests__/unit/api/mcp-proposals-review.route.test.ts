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
const planActionCreate = vi.fn(async (..._a: unknown[]) => ({ id: 'plan-new' }))
const riskItemCount = vi.fn(async (..._a: unknown[]) => 1)
const mesureCreateMany = vi.fn(async (..._a: unknown[]) => ({ count: 1 }))
const orgCount = vi.fn(async (..._a: unknown[]) => 1)
const creerProjet360 = vi.fn(async (..._a: unknown[]) => ({ id: 'projet-new', population: { answers: 0, risks: 0 } }))
// Accès typé au 1er argument d'un appel de mock (Prisma { where?, data }).
const argOf = (fn: { mock: { calls: unknown[][] } }, i = 0) => fn.mock.calls[i][0] as { where?: unknown; data: Record<string, unknown> }
vi.mock('@/lib/prisma', () => ({
  prisma: {
    mcpProposal: { findUnique: (...a: unknown[]) => proposalFindUnique(...a), update: (...a: unknown[]) => proposalUpdate(...a) },
    analyse: { findFirst: (...a: unknown[]) => analyseFindFirst(...a) },
    riskItem: { count: (...a: unknown[]) => riskItemCount(...a) },
    organization: { count: (...a: unknown[]) => orgCount(...a) },
    risque: { create: (...a: unknown[]) => risqueCreate(...a) },
    mesure: { create: (...a: unknown[]) => mesureCreate(...a) },
    planAction: { create: (...a: unknown[]) => planActionCreate(...a) },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({ risque: { create: risqueCreate }, mesure: { create: mesureCreate, createMany: mesureCreateMany }, planAction: { create: planActionCreate }, mcpProposal: { update: proposalUpdate } })),
  },
}))
const effRole = { value: 'ADMIN' as string | null }
vi.mock('@/lib/org-context.server', () => ({
  analyseAccessWhere: vi.fn(async () => ({})),
  getEffectiveRoleForOrg: vi.fn(async () => effRole.value),
}))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn(() => '') }))
const gel = { value: false }
vi.mock('@/lib/org-config.server', () => ({
  getOrgConfig: vi.fn(async () => ({ gelApresAcceptationActive: gel.value, projets360Active: true, patternsArchiMax: 12 })),
  optionsStructure: vi.fn(async () => ({ petiteStructure: false })),
}))
vi.mock('@/lib/configuration-server', () => ({ getEffectiveScaleConfig: vi.fn(async () => ({ nbNiveaux: 4 })) }))
vi.mock('@/lib/projet360-creation.server', () => ({ creerProjet360: (...a: unknown[]) => creerProjet360(...a) }))

import { PATCH } from '@/app/api/mcp-proposals/[id]/route'

const PENDING = { id: 'p1', statut: 'EN_ATTENTE', type: 'risk', targetType: 'ANALYSE', targetId: 'an1', organizationId: 'orgA', payload: { nom: 'Rançongiciel', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE' } }
const ANALYSE = { id: 'an1', userId: 'owner', organizationId: 'orgA', deletedAt: null, accesUtilisateurs: [] }
const req = (body: unknown) => ({ json: async () => body }) as never
const params = { params: Promise.resolve({ id: 'p1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  sessionRole.value = 'ADMIN'; effRole.value = 'ADMIN'; gel.value = false
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

  it('analyse gelée (risques résiduels acceptés) → acceptation 403, aucune écriture', async () => {
    gel.value = true
    analyseFindFirst.mockResolvedValue({ ...ANALYSE, risquesResiduelsStatut: 'ACCEPTES' })
    for (const type of ['risk', 'measure', 'analysis_import']) {
      proposalFindUnique.mockResolvedValue({ ...PENDING, type })
      const res = await PATCH(req({ action: 'accept' }), params)
      expect(res.status).toBe(403)
    }
    expect(risqueCreate).not.toHaveBeenCalled()
    expect(mesureCreate).not.toHaveBeenCalled()
    expect(proposalUpdate).not.toHaveBeenCalled()
  })

  it('analyse gelée : le rejet reste possible (aucune écriture dans l’analyse)', async () => {
    gel.value = true
    analyseFindFirst.mockResolvedValue({ ...ANALYSE, risquesResiduelsStatut: 'ACCEPTES' })
    const res = await PATCH(req({ action: 'reject' }), params)
    expect(res.status).toBe(200)
    expect(argOf(proposalUpdate).data).toMatchObject({ statut: 'REJETEE' })
  })

  it('action invalide → 400', async () => {
    const res = await PATCH(req({ action: 'delete' }), params)
    expect(res.status).toBe(400)
  })

  it('risque/mesure : ancre non-ANALYSE → 400, sans écriture', async () => {
    proposalFindUnique.mockResolvedValue({ ...PENDING, targetType: 'RISQUE' })
    const res = await PATCH(req({ action: 'accept' }), params)
    expect(res.status).toBe(400)
    expect(risqueCreate).not.toHaveBeenCalled()
    expect(mesureCreate).not.toHaveBeenCalled()
  })

  it('accept d\'un plan_action ancré à un RISQUE → crée PlanAction + lien, sous RBAC gouvernance', async () => {
    proposalFindUnique.mockResolvedValue({
      id: 'p1', statut: 'EN_ATTENTE', type: 'plan_action', targetType: 'RISQUE', targetId: 'ri1',
      organizationId: 'orgA', payload: { titre: 'Durcir le VPN', priorite: 'CRITIQUE', statut: 'A_FAIRE' },
    })
    riskItemCount.mockResolvedValue(1)  // ancre existe dans l'org
    effRole.value = 'RISK_MANAGER'      // rôle de gouvernance
    const res = await PATCH(req({ action: 'accept' }), params)
    expect(res.status).toBe(200)
    expect(planActionCreate).toHaveBeenCalledTimes(1)
    const data = argOf(planActionCreate).data
    expect(data).toMatchObject({ organizationId: 'orgA', titre: 'Durcir le VPN' })
    expect(data.liens).toEqual({ create: [{ type: 'RISQUE', targetId: 'ri1' }] })
    expect(argOf(proposalUpdate).data).toMatchObject({ statut: 'ACCEPTEE', appliedId: 'plan-new' })
  })

  it('plan_action : rôle NON gouvernance (ANALYSTE) → 403, aucune écriture', async () => {
    proposalFindUnique.mockResolvedValue({
      id: 'p1', statut: 'EN_ATTENTE', type: 'plan_action', targetType: 'RISQUE', targetId: 'ri1',
      organizationId: 'orgA', payload: { titre: 'X' },
    })
    riskItemCount.mockResolvedValue(1)
    effRole.value = 'ANALYSTE'
    const res = await PATCH(req({ action: 'accept' }), params)
    expect(res.status).toBe(403)
    expect(planActionCreate).not.toHaveBeenCalled()
  })

  it('plan_action : ancre inexistante dans l\'org → 404', async () => {
    proposalFindUnique.mockResolvedValue({
      id: 'p1', statut: 'EN_ATTENTE', type: 'plan_action', targetType: 'RISQUE', targetId: 'ghost',
      organizationId: 'orgA', payload: { titre: 'X' },
    })
    riskItemCount.mockResolvedValue(0)
    const res = await PATCH(req({ action: 'accept' }), params)
    expect(res.status).toBe(404)
    expect(planActionCreate).not.toHaveBeenCalled()
  })
  it('risque proposé avec mesures et plans : tout est créé dans la même transaction, plans rattachés au risque (RISQUE_ANALYSE)', async () => {
    proposalFindUnique.mockResolvedValue({ ...PENDING, payload: { nom: 'Fuite', gravite: 4, vraisemblance: 3, domaine: 'CYBER', mesures: [{ nom: 'Chiffrement', type: 'TECHNIQUE' }], plans: [{ titre: 'AIPD', priorite: 'CRITIQUE', echeance: '2027-01-15' }] } })
    risqueCreate.mockResolvedValueOnce({ id: 'risk-new', nom: 'Fuite' } as never)
    const res = await PATCH(req({ action: 'accept' }), params)
    expect(res.status).toBe(200)
    expect(argOf(risqueCreate).data).toMatchObject({ domaine: 'CYBER', graviteActuelle: 4, niveauResiduel: 12 })
    expect(argOf(mesureCreateMany).data).toEqual([{ analyseId: 'an1', risqueId: 'risk-new', nom: 'Chiffrement', type: 'TECHNIQUE', statut: 'A_FAIRE' }])
    expect(argOf(planActionCreate).data).toMatchObject({ organizationId: 'orgA', titre: 'AIPD', priorite: 'CRITIQUE', liens: { create: [{ type: 'RISQUE_ANALYSE', targetId: 'risk-new', ref: 'an1' }] } })
  })

  it('projet 360 proposé : accepté par un rôle qui crée des analyses (créateur = relecteur) ; refusé en lecture seule', async () => {
    const PROJET = { ...PENDING, type: 'projet360', targetType: 'ORGANISATION', targetId: 'orgA', payload: { nom: 'Espace adhérent 2027', secteur: 'Santé / Médico-social', patternsArchi: ['EXPOSITION_INTERNET'] } }
    proposalFindUnique.mockResolvedValue({ ...PROJET })
    const ok = await PATCH(req({ action: 'accept' }), params)
    expect(ok.status).toBe(200)
    expect(creerProjet360.mock.calls[0][1]).toMatchObject({ userId: 'reviewer', organizationId: 'orgA' })
    expect(argOf(proposalUpdate).data).toMatchObject({ statut: 'ACCEPTEE', appliedId: 'projet-new' })
    vi.clearAllMocks(); proposalFindUnique.mockResolvedValue({ ...PROJET }); effRole.value = 'LECTEUR'
    expect((await PATCH(req({ action: 'accept' }), params)).status).toBe(403)
    expect(creerProjet360).not.toHaveBeenCalled()
  })
})
