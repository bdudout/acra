// ─── Programme de tests de résilience (DORA) — accès serveur ─────────────────
// Contexte commun des routes /api/tests-resilience et de la page : session →
// organisation active → module « reporting réglementaire » ACTIF (sinon 404) →
// lecture (rôles à lecture globale du dispositif) / écriture (peutEvaluerDora).
// Les risques et processus liés sont filtrés sur l'organisation (jamais d'IDOR).

import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'
import { getAnalyseScope } from './org-context.server'
import { getOrgConfig } from './org-config.server'
import { hasGlobalReadDispositif, peutEvaluerDora, type UserRole } from './permissions'
import { sanitizeConstats, type TestResilienceLite } from './tests-resilience'

export interface TestsResilienceContext { userId: string; role: UserRole; orgId: string; canWrite: boolean }

export async function testsResilienceContext(): Promise<{ ok: true; ctx: TestsResilienceContext } | { ok: false; status: 401 | 403 | 404 }> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, status: 401 }
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  if (!scope.activeOrgId) return { ok: false, status: 404 }
  if (!(await getOrgConfig(scope.activeOrgId)).reglementaireActive) return { ok: false, status: 404 }
  if (!hasGlobalReadDispositif(scope.role)) return { ok: false, status: 403 }
  return { ok: true, ctx: { userId, role: scope.role, orgId: scope.activeOrgId, canWrite: peutEvaluerDora(scope.role) } }
}

/** Ne garde que les risques du registre et le processus appartenant à l'organisation. */
export async function scopeLinks(orgId: string, riskItemIds: string[], processusId: string | null) {
  const [risks, processus] = await Promise.all([
    riskItemIds.length ? prisma.riskItem.findMany({ where: { organizationId: orgId, id: { in: riskItemIds } }, select: { id: true } }) : Promise.resolve([]),
    processusId ? prisma.processus.findFirst({ where: { organizationId: orgId, id: processusId }, select: { id: true } }) : Promise.resolve(null),
  ])
  return { riskItemIds: risks.map(r => r.id), processusId: processus?.id ?? null }
}

export const TEST_SELECT = {
  id: true, annee: true, intitule: true, type: true, perimetre: true, fonctionCritique: true, processusId: true,
  riskItemIds: true, testeur: true, independant: true, statut: true, datePrevue: true, dateRealisation: true,
  resultat: true, constats: true, updatedAt: true,
} as const

/** Ligne Prisma → forme pure pour les indicateurs. */
export function toLite(r: { id: string; annee: number; intitule: string; type: string; statut: string; fonctionCritique: boolean; independant: boolean; testeur: string; dateRealisation: Date | null; constats: unknown; riskItemIds: unknown }): TestResilienceLite {
  return {
    ...r,
    constats: sanitizeConstats(r.constats),
    riskItemIds: Array.isArray(r.riskItemIds) ? (r.riskItemIds as unknown[]).filter((x): x is string => typeof x === 'string') : [],
  }
}
