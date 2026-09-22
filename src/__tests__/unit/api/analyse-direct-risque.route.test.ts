/**
 * Saisie directe des risques (/api/analyses/[id]/risques**).
 * Gardes : méthode à saisie directe (sinon 400), édition de l'analyse (rôle
 * effectif, F01 → 403), isolation (analyse/risque introuvable → 404), gel (403).
 * Le niveau est recalculé G×V côté serveur.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'

const sessionRole = { value: 'ADMIN' }
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'reviewer', role: sessionRole.value } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const analyseFindFirst = vi.fn()
const risqueCreate = vi.fn(async (..._a: unknown[]) => ({ id: 'r-new' }))
const risqueFindFirst = vi.fn()
const risqueUpdate = vi.fn(async (..._a: unknown[]) => ({ id: 'r1' }))
const risqueDelete = vi.fn(async (..._a: unknown[]) => ({}))
const argOf = (fn: { mock: { calls: unknown[][] } }, i = 0) => fn.mock.calls[i][0] as { where?: unknown; data: Record<string, unknown> }
vi.mock('@/lib/prisma', () => ({
  prisma: {
    analyse: { findFirst: (...a: unknown[]) => analyseFindFirst(...a) },
    risque: {
      create: (...a: unknown[]) => risqueCreate(...a),
      findFirst: (...a: unknown[]) => risqueFindFirst(...a),
      findMany: vi.fn(async () => []),
      update: (...a: unknown[]) => risqueUpdate(...a),
      delete: (...a: unknown[]) => risqueDelete(...a),
    },
  },
}))
const effRole = { value: 'ADMIN' as string | null }
vi.mock('@/lib/org-context.server', () => ({
  analyseAccessWhere: vi.fn(async () => ({})),
  getEffectiveRoleForOrg: vi.fn(async () => effRole.value),
}))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ gelApresAcceptationActive: false })) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn(() => '') }))

import { POST } from '@/app/api/analyses/[id]/risques/route'
import { PATCH, DELETE } from '@/app/api/analyses/[id]/risques/[riskId]/route'

const ISO = { id: 'an1', userId: 'owner', organizationId: 'orgA', methode: 'ISO_31000', deletedAt: null, risquesResiduelsStatut: 'EN_ATTENTE', accesUtilisateurs: [] }
const req = (body: unknown) => ({ json: async () => body }) as never
const P = { params: Promise.resolve({ id: 'an1' }) }
const PI = { params: Promise.resolve({ id: 'an1', riskId: 'r1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  sessionRole.value = 'ADMIN'; effRole.value = 'ADMIN'
  analyseFindFirst.mockResolvedValue({ ...ISO })
  risqueFindFirst.mockResolvedValue({ id: 'r1', gravite: 2, vraisemblance: 2 })
})

describe('POST /risques (création directe)', () => {
  it('méthode à saisie directe + éditeur → 201, niveau recalculé G×V', async () => {
    const res = await POST(req({ nom: 'Panne SI', gravite: 4, vraisemblance: 3, niveauRisque: 1 }), P)
    expect(res.status).toBe(201)
    expect(argOf(risqueCreate).data).toMatchObject({ analyseId: 'an1', nom: 'Panne SI', gravite: 4, vraisemblance: 3, niveauRisque: 12 })
  })

  it('méthode EBIOS RM (risques dérivés) → 400, aucune création', async () => {
    analyseFindFirst.mockResolvedValue({ ...ISO, methode: 'EBIOS_RM' })
    const res = await POST(req({ nom: 'X' }), P)
    expect(res.status).toBe(400)
    expect(risqueCreate).not.toHaveBeenCalled()
  })

  it('non-éditeur (LECTEUR effectif) → 403', async () => {
    effRole.value = 'LECTEUR'
    const res = await POST(req({ nom: 'X' }), P)
    expect(res.status).toBe(403)
    expect(risqueCreate).not.toHaveBeenCalled()
  })

  it('analyse hors périmètre → 404', async () => {
    analyseFindFirst.mockResolvedValue(null)
    const res = await POST(req({ nom: 'X' }), P)
    expect(res.status).toBe(404)
  })

  it('intitulé vide → 400', async () => {
    const res = await POST(req({ nom: '   ' }), P)
    expect(res.status).toBe(400)
    expect(risqueCreate).not.toHaveBeenCalled()
  })
})

describe('PATCH/DELETE /risques/[riskId]', () => {
  it('PATCH recalcule le niveau à partir des valeurs fusionnées', async () => {
    // existant g=2,v=2 ; patch g=4 → niveau = 4×2 = 8
    const res = await PATCH(req({ gravite: 4 }), PI)
    expect(res.status).toBe(200)
    expect(argOf(risqueUpdate).data).toMatchObject({ gravite: 4, niveauRisque: 8 })
  })

  it('PATCH d\'un risque n\'appartenant pas à l\'analyse → 404', async () => {
    risqueFindFirst.mockResolvedValue(null)
    const res = await PATCH(req({ gravite: 3 }), PI)
    expect(res.status).toBe(404)
    expect(risqueUpdate).not.toHaveBeenCalled()
  })

  it('DELETE supprime ; risque étranger → 404', async () => {
    const ok = await DELETE(req({}), PI)
    expect(ok.status).toBe(200)
    expect(risqueDelete).toHaveBeenCalledTimes(1)

    vi.clearAllMocks(); sessionRole.value = 'ADMIN'; effRole.value = 'ADMIN'
    analyseFindFirst.mockResolvedValue({ ...ISO })
    risqueFindFirst.mockResolvedValue(null)
    const ko = await DELETE(req({}), PI)
    expect(ko.status).toBe(404)
    expect(risqueDelete).not.toHaveBeenCalled()
  })
})
