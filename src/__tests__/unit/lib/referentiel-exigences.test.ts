import { describe, it, expect, vi, beforeEach } from 'vitest'

// Résolveur unifié des exigences : livré cyber (pur) + GRC (pur) + custom (Prisma).
// Seul le chemin custom touche la base → on mocke prisma.referentiel.findFirst.
const referentielFindFirst = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: { referentiel: { findFirst: (...a: unknown[]) => referentielFindFirst(...a) } },
}))

import { getExigencesFor } from '@/lib/referentiel.server'
import { GRC_BUILTINS } from '@/lib/referentiels-builtins-grc'

describe('getExigencesFor', () => {
  beforeEach(() => referentielFindFirst.mockReset())

  it('résout un référentiel cyber livré (sans toucher la base)', async () => {
    const ex = await getExigencesFor('ISO27001', 'org1', 'fr')
    expect(ex.length).toBeGreaterThan(0)
    expect(ex[0]).toHaveProperty('ref')
    expect(referentielFindFirst).not.toHaveBeenCalled()
  })

  it('résout un référentiel GRC livré (RGPD) sans toucher la base', async () => {
    const rgpd = GRC_BUILTINS.find(r => r.code === 'RGPD')!
    const ex = await getExigencesFor('RGPD', 'org1', 'fr')
    expect(ex.length).toBe(rgpd.exigences.length)
    expect(ex.length).toBeGreaterThan(0)
    expect(referentielFindFirst).not.toHaveBeenCalled()
  })

  it('résout un référentiel personnalisé depuis la base', async () => {
    referentielFindFirst.mockResolvedValue({ exigences: [{ ref: 'C1', nom: 'Contrôle 1' }] })
    const ex = await getExigencesFor('MONREF', 'org1', 'fr')
    expect(referentielFindFirst).toHaveBeenCalledOnce()
    expect(ex).toHaveLength(1)
    expect(ex[0].ref).toBe('C1')
  })

  it('renvoie une liste vide pour un référentiel custom introuvable', async () => {
    referentielFindFirst.mockResolvedValue(null)
    const ex = await getExigencesFor('INCONNU', 'org1', 'fr')
    expect(ex).toEqual([])
  })
})
