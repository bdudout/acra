import { it, expect, vi, beforeEach } from 'vitest'
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'owner', role: 'ANALYSTE' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { analyse: { findFirst: vi.fn(), update: vi.fn(async () => ({})) } } }))
// F01 : les décisions RBAC utilisent le rôle EFFECTIF dans l'org de l'analyse.
// Ici le propriétaire est ANALYSTE dans son org → peut éditer (on atteint le gel).
vi.mock('@/lib/org-context.server', () => ({ analyseAccessWhere: vi.fn(async () => ({})), getEffectiveRoleForOrg: vi.fn(async () => 'ANALYSTE') }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ gelApresAcceptationActive: true })) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn() }))
import { PATCH } from '@/app/api/analyses/[id]/route'
import { prisma } from '@/lib/prisma'
beforeEach(() => {
 vi.clearAllMocks()
 vi.mocked(prisma.analyse.findFirst).mockResolvedValue({ id: 'a', userId: 'owner', organizationId: 'org', risquesResiduelsStatut: 'ACCEPTES', accesUtilisateurs: [] } as never)
})
it.each([{ nom: 'Changed' }, { methodeVraisemblance: 'STANDARD' }, { statut: 'EN_COURS' }])('refuse le PATCH après acceptation : %j', async body => {
 const res = await PATCH({ json: async () => body } as never, { params: Promise.resolve({ id: 'a' }) })
 expect(res.status).toBe(403)
 expect(prisma.analyse.update).not.toHaveBeenCalled()
})
it('une réouverture retire la décision d’approbation devenue obsolète', async () => {
 vi.mocked(prisma.analyse.findFirst).mockResolvedValue({ id: 'a', userId: 'owner', organizationId: 'org', statut: 'APPROUVE', risquesResiduelsStatut: 'EN_ATTENTE', accesUtilisateurs: [] } as never)
 const result = await PATCH({ json: async () => ({ statut: 'EN_COURS' }) } as never, { params: Promise.resolve({ id: 'a' }) })
 expect(result.status).toBe(200)
 expect(prisma.analyse.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ approbateurId: null, approuveLe: null, commentaireApprobation: null }) }))
})
