/**
 * Rôle évalué sur l'organisation DE LA RESSOURCE (CWE-863, 2026-10-16). Les routes `[id]` qui
 * cherchent une ressource dans tout le périmètre visible vérifiaient le rôle de l'organisation
 * ACTIVE : un ADMIN « sous-arbre » de A, LECTEUR direct d'une filiale C, pouvait modifier les
 * ressources de C. `roleSurRessource` impose le rôle effectif dans l'organisation de la ressource.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'

const memberships: { organizationId: string; role: string; scope: string }[] = []
const orgs = [
  { id: 'A', path: '/A/', parentId: null },
  { id: 'C', path: '/A/C/', parentId: 'A' },
  { id: 'X', path: '/X/', parentId: null },
]
vi.mock('@/lib/prisma', () => ({
  prisma: {
    orgMembership: { findMany: vi.fn(async () => memberships) },
    organization: { findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => orgs.filter(o => where.id.in.includes(o.id))) },
  },
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))

import { roleSurRessource } from '@/lib/org-context.server'

beforeEach(() => { memberships.length = 0 })

describe('roleSurRessource', () => {
  it('ADMIN sous-arbre de A mais LECTEUR direct de la filiale C → LECTEUR sur une ressource de C', async () => {
    memberships.push({ organizationId: 'A', role: 'ADMIN', scope: 'SUBTREE' }, { organizationId: 'C', role: 'LECTEUR', scope: 'NODE' })
    expect(await roleSurRessource('u', 'ANALYSTE', 'C')).toBe('LECTEUR')
    expect(await roleSurRessource('u', 'ANALYSTE', 'A')).toBe('ADMIN')
  })
  it('couverture par appartenance sous-arbre → rôle de l\'ancêtre', async () => {
    memberships.push({ organizationId: 'A', role: 'RSSI', scope: 'SUBTREE' })
    expect(await roleSurRessource('u', 'ANALYSTE', 'C')).toBe('RSSI')
  })
  it('aucune appartenance couvrante → LECTEUR (moindre privilège), jamais le rôle global', async () => {
    memberships.push({ organizationId: 'A', role: 'ADMIN', scope: 'NODE' })
    expect(await roleSurRessource('u', 'ADMIN', 'X')).toBe('LECTEUR')
  })
  it('SUPER_ADMIN → SUPER_ADMIN', async () => {
    expect(await roleSurRessource('u', 'SUPER_ADMIN', 'X')).toBe('SUPER_ADMIN')
  })
})
