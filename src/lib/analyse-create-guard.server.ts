// ─── Garde de création d'une analyse (point unique) ──────────────────────────
// Audit 2026-10-01 (T11) : `/api/import` créait des analyses SANS organisation
// (hors du périmètre de l'org : invisibles de l'admin et du RSSI), sans contrôle
// du droit de création (un LECTEUR pouvait importer) ni du plafond démo. Toute
// création d'analyse passe désormais par ce contrôle, comme POST /api/analyses.

import { optionsStructure } from '@/lib/org-config.server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { canCreateAnalyse, type UserRole } from '@/lib/permissions'
import { isDemoInstance, getDemoConfig } from '@/lib/demo-server'
import { analysisCapReached } from '@/lib/demo'

export type AnalyseCreationCheck =
  | { ok: true; organizationId: string; scope: Awaited<ReturnType<typeof getAnalyseScope>> }
  | { ok: false; reason: 'ROLE' | 'NO_ORG' | 'DEMO_CAP' }

/** Rôle EFFECTIF dans l'organisation active, organisation active obligatoire, plafond démo. */
export async function checkAnalyseCreation(userId: string, instanceRole: UserRole): Promise<AnalyseCreationCheck> {
  const scope = await getAnalyseScope(userId, instanceRole)
  if (!canCreateAnalyse({ id: userId, role: scope.role }, await optionsStructure(scope.activeOrgId))) return { ok: false, reason: 'ROLE' }
  if (!scope.activeOrgId) return { ok: false, reason: 'NO_ORG' }
  if (await isDemoInstance()) {
    const count = await prisma.analyse.count({ where: { organizationId: scope.activeOrgId } })
    if (analysisCapReached(count, await getDemoConfig())) return { ok: false, reason: 'DEMO_CAP' }
  }
  return { ok: true, organizationId: scope.activeOrgId, scope }
}
