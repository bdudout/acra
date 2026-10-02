import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ session: vi.fn(), scope: vi.fn(), sectors: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/sector-context.server', () => ({ orgSectors: m.sectors }))
import { GET } from '@/app/api/catalogue-suggestions/active-sectors/route'

beforeEach(() => {
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1' })
  m.sectors.mockResolvedValue({ own: [], effective: ['SANTE', 'SAAS'], inherited: false })
})

describe('GET /api/catalogue-suggestions/active-sectors', () => {
  it('401 sans session, 400 sans organisation active', async () => {
    m.session.mockResolvedValue(null); expect((await GET()).status).toBe(401)
    m.session.mockResolvedValue({ user: { id: 'u1' } }); m.scope.mockResolvedValue({ activeOrgId: null }); expect((await GET()).status).toBe(400)
  })
  it('renvoie les secteurs effectifs de l’organisation active (ordre conservé), pour tout rôle', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ effective: ['SANTE', 'SAAS'] })
    expect(m.sectors).toHaveBeenCalledWith('o1')
  })
})
