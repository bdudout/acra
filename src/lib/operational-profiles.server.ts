// ─── Profils opérationnels US/UK — accès serveur ──────────────────────────────
// Point unique pour les routes et la page /profils-operationnels : contexte
// (session → org active → rôle effectif dans l'org → module ACTIF, sinon 404) et
// chargement des profils avec leurs statistiques et actions liées. La logique
// décidable (catalogue, fusion, stats, résumé des actions) est dans la lib pure
// `operational-profiles.ts`.

import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { prisma } from './prisma'
import { getAnalyseScope } from './org-context.server'
import { getOrgConfig } from './org-config.server'
import { peutEvaluerProfilOperationnel, type UserRole } from './permissions'
import {
  OPERATIONAL_PROFILE_CATALOGS, OPERATIONAL_PROFILE_FRAMEWORKS,
  sanitizeOperationalProfileEntries, operationalProfileStats, summarizeOperationalProfileActions,
  type OperationalProfileFramework, type OperationalProfileEntry, type OperationalProfileStats,
  type OperationalProfileActionSummary,
} from './operational-profiles'

export interface OperationalProfileContext { userId: string; role: UserRole; orgId: string; canManage: boolean }

/**
 * Contexte d'accès. 401 sans session ; 404 sans organisation active ou si le
 * module est inactif (valeur EFFECTIVE, politique d'instance incluse) — un module
 * désactivé n'existe pas pour l'utilisateur.
 */
export async function operationalProfileContext(): Promise<{ ok: true; ctx: OperationalProfileContext } | { ok: false; status: 401 | 404 }> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, status: 401 }
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  if (!scope.activeOrgId) return { ok: false, status: 404 }
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.profilsOperationnelsActive) return { ok: false, status: 404 }
  return { ok: true, ctx: { userId, role: scope.role, orgId: scope.activeOrgId, canManage: peutEvaluerProfilOperationnel(scope.role) } }
}

export interface LoadedOperationalProfile {
  framework: OperationalProfileFramework
  id: string | null
  cible: string | null
  entries: OperationalProfileEntry[]
  updatedAt: string | null
  stats: OperationalProfileStats
  /** Actions liées par référence de point. */
  actions: Record<string, OperationalProfileActionSummary>
  actionsOpen: number
  actionsOverdue: number
}

/** Profils de l'organisation (un par cadre, état vierge si jamais évalué). */
export async function loadOperationalProfiles(orgId: string, now = new Date()): Promise<LoadedOperationalProfile[]> {
  const rows = await prisma.operationalProfile.findMany({
    where: { organizationId: orgId },
    select: { id: true, framework: true, cible: true, entries: true, updatedAt: true },
  })
  const ids = rows.map(r => r.id)
  const actionRows = ids.length
    ? await prisma.planAction.findMany({
        where: { organizationId: orgId, liens: { some: { type: 'OPERATIONAL_PROFILE', targetId: { in: ids } } } },
        select: { statut: true, echeance: true, liens: { where: { type: 'OPERATIONAL_PROFILE', targetId: { in: ids } }, select: { targetId: true, ref: true } } },
      })
    : []
  const summary = summarizeOperationalProfileActions(actionRows, now)
  return OPERATIONAL_PROFILE_FRAMEWORKS.map(framework => {
    const row = rows.find(r => r.framework === framework)
    const entries = sanitizeOperationalProfileEntries(framework, row?.entries)
    const actions: Record<string, OperationalProfileActionSummary> = {}
    let actionsOpen = 0, actionsOverdue = 0
    if (row) {
      for (const item of OPERATIONAL_PROFILE_CATALOGS[framework].items) {
        const s = summary.get(`${row.id}|${item.ref}`)
        if (!s) continue
        actions[item.ref] = s
        actionsOpen += s.open
        actionsOverdue += s.overdue
      }
    }
    return {
      framework, id: row?.id ?? null, cible: row?.cible ?? null, entries,
      updatedAt: row?.updatedAt.toISOString() ?? null,
      stats: operationalProfileStats(entries, OPERATIONAL_PROFILE_CATALOGS[framework].items.length),
      actions, actionsOpen, actionsOverdue,
    }
  })
}
