import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAnalyseScope } from '@/lib/org-context.server'
import { isDemoInstance, touchOrgActivity } from '@/lib/demo-server'
import { createExampleAnalyse } from '@/lib/demo-example'
import { auditLog, getClientIp } from '@/lib/logger'
import type { UserRole } from '@/lib/permissions'

/**
 * POST /api/demo/load-example — charge un exemple d'analyse complet (5 ateliers)
 * dans l'organisation du testeur (ACRA-Demo). Décision produit : l'org démo est vide
 * à la création, ce bouton la peuple pour la démonstration. Idempotent par org.
 *
 * Réservé aux instances de démo prouvées (`isDemoInstance()`), utilisateur authentifié
 * disposant d'une organisation active.
 */
export async function POST(req: Request) {
  if (!(await isDemoInstance())) {
    return NextResponse.json({ error: 'Instance non démo' }, { status: 403 })
  }
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: UserRole }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, userRole)
  if (!scope.activeOrgId) {
    return NextResponse.json({ error: 'Aucune organisation active' }, { status: 403 })
  }

  const result = await createExampleAnalyse(userId, scope.activeOrgId)
  await touchOrgActivity(scope.activeOrgId).catch(() => {})
  if (!result.alreadyExisted) {
    await auditLog('ANALYSE_CREATED', {
      userId, ip: getClientIp(req),
      targetType: 'analyse', targetId: result.id,
      details: { demoExample: true, orgId: scope.activeOrgId },
    })
  }
  return NextResponse.json({ ok: true, analyseId: result.id, alreadyExisted: result.alreadyExisted })
}
