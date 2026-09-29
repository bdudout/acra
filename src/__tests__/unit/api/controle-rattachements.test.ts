import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ tiers: vi.fn(), analyse: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { arrangementTic: { findFirst: m.tiers }, analyse: { findFirst: m.analyse } } }))
import { verifierRattachements } from '@/lib/controle-rattachements.server'

beforeEach(() => { vi.clearAllMocks(); m.tiers.mockResolvedValue({ id: 't1' }); m.analyse.mockResolvedValue({ id: 'p1' }) })

describe('verifierRattachements', () => {
  it('sans clé : rien à vérifier, aucune requête', async () => {
    expect(await verifierRattachements({}, 'o1')).toEqual({ ok: true, data: {} })
    expect(m.tiers).not.toHaveBeenCalled(); expect(m.analyse).not.toHaveBeenCalled()
  })
  it('vérifie l’appartenance à l’organisation (tiers, projet 360 non supprimé)', async () => {
    expect(await verifierRattachements({ arrangementTicId: 't1', projetId: 'p1' }, 'o1')).toEqual({ ok: true, data: { arrangementTicId: 't1', projetId: 'p1' } })
    expect(m.tiers).toHaveBeenCalledWith({ where: { id: 't1', organizationId: 'o1' }, select: { id: true } })
    expect(m.analyse).toHaveBeenCalledWith({ where: { id: 'p1', organizationId: 'o1', methode: 'PROJET_360', deletedAt: null }, select: { id: true } })
  })
  it('identifiant d’une autre organisation : refusé', async () => {
    m.tiers.mockResolvedValue(null)
    expect(await verifierRattachements({ arrangementTicId: 'autre' }, 'o1')).toEqual({ ok: false, error: 'tiers_invalide' })
    m.analyse.mockResolvedValue(null)
    expect(await verifierRattachements({ projetId: 'autre' }, 'o1')).toEqual({ ok: false, error: 'projet_invalide' })
  })
  it('détachement : null accepté sans requête', async () => {
    expect(await verifierRattachements({ arrangementTicId: null, projetId: '' }, 'o1')).toEqual({ ok: true, data: { arrangementTicId: null, projetId: null } })
    expect(m.tiers).not.toHaveBeenCalled()
  })
})
