/** Projet 360 de rattachement d'une analyse : seulement s'il reste accessible à l'utilisateur et est un projet 360. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ analyse: { findFirst: vi.fn(), findMany: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/org-context.server', () => ({
  getEffectiveRoleForOrg: vi.fn(async () => 'ANALYSTE'),
  analyseAccessWhere: vi.fn(async (_u: string, _r: string, id: string) => ({ id, ACCES: true })),
}))

import { projetLieAccessible } from '@/lib/projet360-sources.server'

beforeEach(() => vi.clearAllMocks())
describe('projetLieAccessible', () => {
  it('sans rattachement : null, sans requête', async () => {
    expect(await projetLieAccessible('u', 'ANALYSTE', null)).toBeNull()
    expect(db.analyse.findFirst).not.toHaveBeenCalled()
  })
  it('filtre d’accès + projet 360 non supprimé ; ne renvoie que id et nom', async () => {
    db.analyse.findFirst.mockResolvedValueOnce({ id: 'p', nom: 'Projet' })
    expect(await projetLieAccessible('u', 'ANALYSTE', 'p')).toEqual({ id: 'p', nom: 'Projet' })
    const arg = db.analyse.findFirst.mock.calls[0][0]
    expect(arg.where).toEqual({ id: 'p', ACCES: true, methode: 'PROJET_360', deletedAt: null })
    expect(arg.select).toEqual({ id: true, nom: true })
  })
})
