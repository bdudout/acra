// ─── Processus de cartographie des risques — personnalisation ────────────────
// PUT : enregistre le texte du processus (étapes, périodicité de revue) dans la
// configuration de l'organisation ACTIVE. Gouvernance uniquement (ADMIN, RSSI,
// RISK_MANAGER) ; registre des risques inactif → 404. {} = retour au défaut.

import { NextResponse } from 'next/server'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig, upsertOrgConfig } from '@/lib/org-config.server'
import { isAdminRole } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { sanitizeProcessusCarto } from '@/lib/processus-carto'
import { auditLog, getClientIp } from '@/lib/logger'

// org: 'none' : sans organisation active, la route répond 404 (et non 400) — périmètre résolu dans le handler.
export const PUT = withAccess({ org: 'none', rateLimit: { bucket: 'processus-carto' } }, async (req, { user }) => {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  if (!scope.activeOrgId || !(await getOrgConfig(scope.activeOrgId)).registreRisquesActive) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (!(isAdminRole(scope.role) || scope.role === 'RSSI' || scope.role === 'RISK_MANAGER')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const reset = body && typeof body === 'object' && Object.keys(body).length === 0
  const value = reset ? {} : sanitizeProcessusCarto(body)
  await upsertOrgConfig(scope.activeOrgId, { processusCartographie: value as object })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId, userRole: scope.role, organizationId: scope.activeOrgId, ip: getClientIp(req), details: { fields: ['processusCartographie'], reset } })
  return NextResponse.json({ processus: value })
})
