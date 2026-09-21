/**
 * F01 (CWE-863) — les décisions d'écriture sur une analyse utilisent le rôle
 * EFFECTIF dans l'organisation de l'analyse, pas le rôle d'INSTANCE.
 *
 * Scénario : un ADMIN d'instance qui n'est que LECTEUR dans l'organisation B
 * (et n'est pas propriétaire) voit l'analyse (visibilité admin) mais NE DOIT PAS
 * pouvoir l'éditer, la supprimer ni sauvegarder un atelier. Avant correctif, le
 * rôle global ADMIN accordait ces droits (403 attendu désormais).
 */
import { beforeEach, describe, it, expect, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'attacker', role: 'ADMIN' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { analyse: { findFirst: vi.fn(), update: vi.fn(async () => ({})) } } }))
vi.mock('@/lib/org-context.server', () => ({
  analyseAccessWhere: vi.fn(async () => ({})),
  // L'attaquant n'est que LECTEUR dans l'organisation de l'analyse.
  getEffectiveRoleForOrg: vi.fn(async () => 'LECTEUR'),
}))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ gelApresAcceptationActive: false, conformiteActive: true })) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn(() => '') }))

import { PATCH, DELETE } from '@/app/api/analyses/[id]/route'
import { PUT as workshopPut } from '@/app/api/analyses/[id]/workshop/[num]/route'
import { prisma } from '@/lib/prisma'

// Analyse APPARTENANT À UN AUTRE utilisateur, dans une organisation où l'attaquant est LECTEUR.
const FOREIGN_ANALYSE = { id: 'a', userId: 'owner', organizationId: 'orgB', statut: 'EN_COURS', accesUtilisateurs: [] }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.analyse.findFirst).mockResolvedValue(FOREIGN_ANALYSE as never)
})

describe('F01 — rôle effectif d\'organisation pour les écritures sur analyse', () => {
  it('PATCH refuse un ADMIN d\'instance LECTEUR dans l\'org (403), sans écrire', async () => {
    const res = await PATCH({ json: async () => ({ nom: 'Hijack' }) } as never, { params: Promise.resolve({ id: 'a' }) })
    expect(res.status).toBe(403)
    expect(prisma.analyse.update).not.toHaveBeenCalled()
  })

  it('DELETE refuse un ADMIN d\'instance LECTEUR dans l\'org (403), sans supprimer', async () => {
    const res = await DELETE({} as never, { params: Promise.resolve({ id: 'a' }) })
    expect(res.status).toBe(403)
    expect(prisma.analyse.update).not.toHaveBeenCalled()
  })

  it('PUT atelier refuse un ADMIN d\'instance LECTEUR dans l\'org (403)', async () => {
    const res = await workshopPut({ json: async () => ({}) } as never, { params: Promise.resolve({ id: 'a', num: '1' }) })
    expect(res.status).toBe(403)
  })
})
