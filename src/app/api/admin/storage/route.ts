// ─── Supervision du stockage — docs/specs/stockage-supervision-nettoyage.md, lot A ───
// GET : SUPER_ADMIN → rapport d'instance (cache serveur 5 min, ?fresh=1 force la mesure) ; ADMIN → seulement la part
// « documents » de son périmètre, en lecture. PUT : seuils d'alerte (SUPER_ADMIN).

import { NextRequest, NextResponse } from 'next/server'
import { requireSession, requireInstanceAdmin } from '@/lib/route-guard.server'
import { canAdminInstance, isAdminRole } from '@/lib/permissions'
import { getAccessibleOrgIds } from '@/lib/org-context.server'
import { getStorageReport, orgDocumentsUsage, resetStorageCache, saveThresholds } from '@/lib/storage-usage.server'
import { validateThresholds } from '@/lib/storage-usage'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await requireSession()
  if (g.error) return g.error
  if (canAdminInstance({ id: g.user.id, role: g.user.role })) {
    const report = await getStorageReport({ fresh: req.nextUrl.searchParams.get('fresh') === '1' })
    return NextResponse.json({ scope: 'instance', report })
  }
  if (!isAdminRole(g.user.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  const scope = await getAccessibleOrgIds(g.user.id, g.user.role)
  return NextResponse.json({ scope: 'organization', documents: await orgDocumentsUsage(scope) })
}

export async function PUT(req: NextRequest) {
  const g = await requireInstanceAdmin(req)
  if (g.error) return g.error
  const v = validateThresholds(await req.json().catch(() => null))
  if (!v.ok) return NextResponse.json({ error: 'invalid_thresholds' }, { status: 400 })
  await saveThresholds(v.value)
  resetStorageCache()
  await auditLog('INSTANCE_STORAGE_THRESHOLDS_CHANGED', { userId: g.user.id, userRole: g.user.role, targetType: 'instance', ip: getClientIp(req), details: { ...v.value } })
  return NextResponse.json({ thresholds: v.value })
}
