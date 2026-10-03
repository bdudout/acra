/** Toute option de la configuration d'organisation doit être lue en base, sinon son réglage est ignoré. */
import { describe, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({
  organization: { findUnique: vi.fn() },
  organizationConfig: { findMany: vi.fn() },
  configuration: { findUnique: vi.fn(async () => null) },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
import { CONFIG_SELECT, getOrgConfig } from '@/lib/org-config.server'
import { DEFAULT_ORG_CONFIG } from '@/lib/org-config'

describe('lecture de la configuration d’organisation', () => {
  it('toutes les activations de modules (champs …Active) sont sélectionnées', () => {
    const actives = Object.keys(DEFAULT_ORG_CONFIG).filter(k => k.endsWith('Active'))
    expect(actives).toEqual(expect.arrayContaining(['homologationsActive', 'recertificationActive', 'registreIaActive']))
    expect(actives.filter(k => !(k in CONFIG_SELECT))).toEqual([])
  })
  it('un chemin matérialisé vide ou dégénéré retombe sur l’organisation elle-même', async () => {
    db.organization.findUnique.mockResolvedValue({ path: '/' })
    db.organizationConfig.findMany.mockResolvedValue([{ id: 'o1', homologationsActive: true }])
    const cfg = await getOrgConfig('o1')
    expect(db.organizationConfig.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['o1'] } })
    expect(cfg.homologationsActive).toBe(true)
  })
})
