/** GET /api/projets : liste vide si module inactif, projets accessibles sinon, 401 sans session. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  session: vi.fn(), scope: vi.fn(), config: vi.fn(),
  findMany: vi.fn(),
}))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { analyse: { findMany: m.findMany } } }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: m.scope }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: m.config }))

import { GET } from '@/app/api/projets/route'

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1', role: 'ANALYSTE' } })
  m.scope.mockResolvedValue({ activeOrgId: 'o1', role: 'ANALYSTE', scope: { visibleOrgIds: ['o1'], isSuperAdmin: false } })
  m.config.mockResolvedValue({ projets360Active: true })
  m.findMany.mockResolvedValue([{ id: 'p1', nom: 'Refonte', description: null, secteur: 'Santé', patternsArchi: ['SI_STANDARD'] }])
})

describe('GET /api/projets', () => {
  it('401 sans session', async () => {
    m.session.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
  })
  it('liste vide (sans requête) quand le module Projets 360 est inactif', async () => {
    m.config.mockResolvedValue({ projets360Active: false })
    const res = await GET()
    expect(await res.json()).toEqual({ projets: [] })
    expect(m.findMany).not.toHaveBeenCalled()
  })
  it('renvoie les projets 360 de l’organisation active', async () => {
    const res = await GET()
    expect(await res.json()).toEqual({ projets: [{ id: 'p1', nom: 'Refonte', description: null, secteur: 'Santé', patternsArchi: ['SI_STANDARD'] }] })
    expect(m.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: 'o1', methode: 'PROJET_360' })
    expect(m.findMany.mock.calls[0][0].select).toMatchObject({ secteur: true, patternsArchi: true })
  })
})
