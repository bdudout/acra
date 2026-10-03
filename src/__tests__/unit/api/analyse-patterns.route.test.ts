// Lot A1 — patterns d'architecture : enregistrement par POST / PATCH, plafond configurable de l'organisation.
import { it, expect, vi, beforeEach, describe } from 'vitest'
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'owner', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { analyse: { findFirst: vi.fn(), update: vi.fn(async () => ({})) } } }))
vi.mock('@/lib/org-context.server', () => ({ analyseAccessWhere: vi.fn(async () => ({})), getEffectiveRoleForOrg: vi.fn(async () => 'ANALYSTE') }))
const max = { value: 12 }
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ patternsArchiMax: max.value })) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn() }))
import { PATCH } from '@/app/api/analyses/[id]/route'
import { prisma } from '@/lib/prisma'

const patch = (body: unknown) => PATCH({ json: async () => body } as never, { params: Promise.resolve({ id: 'a' }) })
beforeEach(() => {
  vi.clearAllMocks(); max.value = 12
  vi.mocked(prisma.analyse.findFirst).mockResolvedValue({ id: 'a', userId: 'owner', organizationId: 'org', statut: 'EN_COURS', risquesResiduelsStatut: 'EN_ATTENTE', patternsArchi: ['DMZ'], accesUtilisateurs: [] } as never)
})

describe('PATCH /api/analyses/[id] — patternsArchi', () => {
  it('enregistre des codes connus, sans doublon ; les codes inconnus sont ignorés', async () => {
    const res = await patch({ patternsArchi: ['EXPOSITION_INTERNET', 'PIRATE', 'DMZ', 'DMZ'] })
    expect(res.status).toBe(200)
    expect(prisma.analyse.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ patternsArchi: ['EXPOSITION_INTERNET', 'DMZ'] }) }))
  })
  it('liste vide acceptée (aucun pattern = comportement actuel)', async () => {
    expect((await patch({ patternsArchi: [] })).status).toBe(200)
    expect(prisma.analyse.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ patternsArchi: [] }) }))
  })
  it('plafond de l’organisation réglé à 6 : une 7ᵉ case est refusée (400), rien n’est écrit', async () => {
    max.value = 6
    const sept = ['EXPOSITION_INTERNET', 'DMZ', 'ZONE_CONFIANCE', 'ZONE_MOINDRE_CONFIANCE', 'ACCES_DISTANT', 'INTERCO_TIERS', 'API_PARTENAIRES']
    const res = await patch({ patternsArchi: sept })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('patterns_too_many')
    expect(prisma.analyse.update).not.toHaveBeenCalled()
    expect((await patch({ patternsArchi: sept.slice(0, 6) })).status).toBe(200)
  })
  it('sans le champ, les patterns existants ne sont pas touchés', async () => {
    await patch({ nom: 'Autre nom' })
    const data = vi.mocked(prisma.analyse.update).mock.calls[0][0].data as Record<string, unknown>
    expect('patternsArchi' in data).toBe(false)
  })
  it('changer de secteur ne modifie pas les patterns (indépendants du secteur)', async () => {
    await patch({ secteur: 'Banque' })
    const data = vi.mocked(prisma.analyse.update).mock.calls[0][0].data as Record<string, unknown>
    expect('patternsArchi' in data).toBe(false)
  })
})
