/**
 * Actions « promotables » vers le plan d'action unifié (mesures d'analyse,
 * incidents…) — candidates au rattachement d'un contrôle de conformité. Lecture
 * dans le périmètre visible.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { gatherPromotableActions } from '@/lib/promotable-actions.server'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ orgId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { orgId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, userRole)
  const visibles = scope.scope.visibleOrgIds ?? []
  if (!(orgId === 'global' || visibles.length === 0 || visibles.includes(orgId))) {
    return NextResponse.json({ error: 'Organisation hors périmètre' }, { status: 403 })
  }
  const cfg = await getOrgConfig(orgId)
  const actions = await gatherPromotableActions(orgId, { incidentsActive: cfg.incidentsActive })
  return NextResponse.json({ actions })
}
