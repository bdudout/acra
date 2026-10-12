// Pack postal L4.2 : /api/analyses/default-org renvoie, en plus du nom, le secteur à présélectionner quand les secteurs
// effectifs de l'organisation active se ramènent à un seul libellé (sinon null).
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ scope: vi.fn(), sectors: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-active', () => ({ orgNameForPrefill: () => 'Bac à sable — Groupe' }))
vi.mock('@/lib/sector-context.server', () => ({ orgSectors: m.sectors }))
import { GET } from '@/app/api/analyses/default-org/route'

beforeEach(() => { vi.clearAllMocks(); m.scope.mockResolvedValue({ activeOrgId: 'o1', memberships: [] }) })

describe('GET /api/analyses/default-org — secteur présélectionné', () => {
  it('un seul secteur effectif → son libellé ; plusieurs → null', async () => {
    m.sectors.mockResolvedValue({ own: [], effective: ['PUBLIC'], inherited: true })
    expect(await (await GET()).json()).toEqual({ name: 'Bac à sable — Groupe', secteur: 'Administration publique' })
    m.sectors.mockResolvedValue({ own: ['PUBLIC', 'FINANCE'], effective: ['PUBLIC', 'FINANCE'], inherited: false })
    expect((await (await GET()).json()).secteur).toBeNull()
  })
  it('sans organisation active : aucun secteur', async () => {
    m.scope.mockResolvedValue({ activeOrgId: null, memberships: [] })
    expect((await (await GET()).json()).secteur).toBeNull()
    expect(m.sectors).not.toHaveBeenCalled()
  })
})
