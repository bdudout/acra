/**
 * Risques proposés par la qualification (/api/analyses/[id]/qualification-risks).
 * GET : propositions traduites + état (déjà créé). POST : sélection ∪ imposés,
 * idempotent par règle, atomique ; EBIOS RM → atelier 5 (400) ; gel (403) ;
 * droit d'édition (403) ; hors périmètre (404).
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const analyseFindFirst = vi.fn()
const createMany = vi.fn(async (..._a: unknown[]) => ({ count: 0 }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    analyse: { findFirst: (...a: unknown[]) => analyseFindFirst(...a) },
    $transaction: async (fn: (tx: unknown) => unknown) => fn({ risque: { createMany: (...a: unknown[]) => createMany(...a) } }),
  },
}))
const effRole = { value: 'ANALYSTE' as string | null }
vi.mock('@/lib/org-context.server', () => ({
  analyseAccessWhere: vi.fn(async () => ({})),
  getEffectiveRoleForOrg: vi.fn(async () => effRole.value),
}))
const gel = { value: false }
const RULES = [
  { id: 'cyber-personal-data', when: { questionId: 'donneesPersonnelles', equals: true }, risk: { category: 'CYBER', title: '', titleKey: 'personalData', gravity: 4, likelihood: 2, strategy: 'REDUIRE' } },
  { id: 'fraude', mandatory: true, when: { questionId: 'donneesPersonnelles', equals: true }, risk: { category: 'FRAUD', title: 'Fraude au président', gravity: 3, likelihood: 2, strategy: 'REDUIRE' } },
  { id: 'expo', when: { questionId: 'expositionInternet', equals: true }, risk: { category: 'CYBER', title: 'Exposition', gravity: 3, likelihood: 3, strategy: 'REDUIRE' } },
]
vi.mock('@/lib/org-config.server', () => ({
  getOrgConfig: vi.fn(async () => ({ gelApresAcceptationActive: gel.value, qualificationQuestionnaire: { overrides: {}, custom: [], riskRules: RULES } })),
}))
const auditLog = vi.fn()
vi.mock('@/lib/logger', () => ({ auditLog: (...a: unknown[]) => auditLog(...a), getClientIp: vi.fn(() => '') }))
vi.mock('@/lib/i18n', () => ({
  getServerT: vi.fn(async () => ({ qualification: { riskCatalog: { personalData: { title: 'Atteinte aux données personnelles', description: 'Divulgation…' } } } })),
}))

import { GET, POST } from '@/app/api/analyses/[id]/qualification-risks/route'

const ISO = {
  id: 'an1', userId: 'u1', organizationId: 'orgA', methode: 'ISO_27005', deletedAt: null,
  risquesResiduelsStatut: 'EN_ATTENTE', accesUtilisateurs: [],
  qualification: { donneesPersonnelles: true, expositionInternet: true }, risques: [] as { qualificationRuleId: string | null }[],
}
const req = (body?: unknown) => ({ json: async () => body ?? {} }) as never
const P = { params: Promise.resolve({ id: 'an1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  effRole.value = 'ANALYSTE'; gel.value = false
  analyseFindFirst.mockResolvedValue({ ...ISO, risques: [] })
  createMany.mockImplementation(async (arg: unknown) => ({ count: (arg as { data: unknown[] }).data.length }))
})

describe('GET qualification-risks', () => {
  it('renvoie les propositions traduites, le caractère imposé et l’état « déjà créé »', async () => {
    analyseFindFirst.mockResolvedValue({ ...ISO, risques: [{ qualificationRuleId: 'expo' }] })
    const res = await GET(req(), P)
    const body = await res.json()
    expect(body.channel).toBe('DIRECT')
    expect(body.proposals.map((p: { id: string; title: string; mandatory: boolean; alreadyCreated: boolean }) => [p.id, p.title, p.mandatory, p.alreadyCreated])).toEqual([
      ['cyber-personal-data', 'Atteinte aux données personnelles', false, false],
      ['fraude', 'Fraude au président', true, false],
      ['expo', 'Exposition', false, true],
    ])
  })

  it('404 hors périmètre', async () => {
    analyseFindFirst.mockResolvedValue(null)
    expect((await GET(req(), P)).status).toBe(404)
  })
})

describe('POST qualification-risks', () => {
  it('crée la sélection + les risques imposés, avec la règle d’origine, sans doublon', async () => {
    analyseFindFirst.mockResolvedValue({ ...ISO, risques: [{ qualificationRuleId: 'expo' }] })
    const res = await POST(req({ ruleIds: ['cyber-personal-data', 'expo'] }), P)
    expect(res.status).toBe(201)
    const data = (createMany.mock.calls[0][0] as { data: Record<string, unknown>[]; skipDuplicates: boolean })
    expect(data.skipDuplicates).toBe(true)
    expect(data.data.map(d => [d.qualificationRuleId, d.nom, d.niveauRisque])).toEqual([
      ['cyber-personal-data', 'Atteinte aux données personnelles', 8],
      ['fraude', 'Fraude au président', 6],
    ])
    const body = await res.json()
    expect(body.created).toBe(2)
    expect(body.skipped).toEqual([{ id: 'expo', reason: 'ALREADY_CREATED' }])
    expect(auditLog).toHaveBeenCalledTimes(1)
  })

  it('un risque imposé est créé même s’il n’est pas sélectionné', async () => {
    await POST(req({ ruleIds: [] }), P)
    expect((createMany.mock.calls[0][0] as { data: { qualificationRuleId: string }[] }).data.map(d => d.qualificationRuleId)).toEqual(['fraude'])
  })

  it('EBIOS RM : refus explicite (les risques se proposent en atelier 5)', async () => {
    analyseFindFirst.mockResolvedValue({ ...ISO, methode: 'EBIOS_RM' })
    const res = await POST(req({ ruleIds: ['cyber-personal-data'] }), P)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('ebios_via_atelier5')
    expect(createMany).not.toHaveBeenCalled()
  })

  it('analyse gelée : 403 et aucune création', async () => {
    gel.value = true
    analyseFindFirst.mockResolvedValue({ ...ISO, risquesResiduelsStatut: 'ACCEPTES' })
    expect((await POST(req({ ruleIds: ['expo'] }), P)).status).toBe(403)
    expect(createMany).not.toHaveBeenCalled()
  })

  it('sans droit d’édition : 403', async () => {
    effRole.value = 'LECTEUR'
    analyseFindFirst.mockResolvedValue({ ...ISO, userId: 'autre' })
    expect((await POST(req({ ruleIds: ['expo'] }), P)).status).toBe(403)
    expect(createMany).not.toHaveBeenCalled()
  })
})
