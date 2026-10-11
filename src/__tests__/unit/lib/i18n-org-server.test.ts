// Pages rendues côté serveur : le vocabulaire de l'organisation active s'applique aussi (limite connue du lot L5).
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ vocabulaire: { projet: { '*': 'Chantiers' }, derogation: { fr: 'Exceptions' } } })) }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'fr' }) }) }))
import { getServerTOrg } from '@/lib/i18n-org'

describe('getServerTOrg', () => {
  it('applique le vocabulaire de l’organisation ; sans organisation, libellés livrés', async () => {
    const t = await getServerTOrg('org1')
    expect(t.projets.title).toBe('Chantiers')
    expect(t.derogations.title).toBe('Exceptions')
    const sans = await getServerTOrg(null)
    expect(sans.projets.title).not.toBe('Chantiers')
  })
})
