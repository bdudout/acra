import { NextRequest, NextResponse } from 'next/server'
import { optionsStructure } from '@/lib/org-config.server'
import { getAnalyseScope } from '@/lib/org-context.server'
import { isDemoInstance, touchOrgActivity, getDemoConfig } from '@/lib/demo-server'
import { createExampleAnalyse } from '@/lib/demo-example'
import { auditLog, getClientIp } from '@/lib/logger'
import { canCreateAnalyse } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'

/**
 * POST /api/demo/load-example — charge un exemple d'analyse complet (5 ateliers)
 * dans l'organisation du testeur (ACRA-Demo). Décision produit : l'org démo est vide
 * à la création, ce bouton la peuple pour la démonstration. Idempotent par org.
 *
 * Réservé aux instances de démo prouvées (`isDemoInstance()`), utilisateur authentifié
 * disposant d'une organisation active.
 * org: 'none' : sans organisation active, la route répond 403 (et non 400) — périmètre résolu dans le handler.
 */
const chargerExemple = withAccess({ org: 'none', rateLimit: { bucket: 'demo-load-example' } }, async (req, { user }) => {
  const userId = user.id
  const scope = await getAnalyseScope(userId, user.role)
  // Rôle EFFECTIF dans l'organisation active (pas le rôle d'instance) → A01/CWE-863.
  const userRole = scope.role
  if (!scope.activeOrgId) {
    return NextResponse.json({ error: 'Aucune organisation active' }, { status: 403 })
  }

  if (!canCreateAnalyse({ id: userId, role: userRole }, await optionsStructure(scope.activeOrgId))) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }
  let result
  try {
    const config = await getDemoConfig()
    result = await createExampleAnalyse(userId, scope.activeOrgId, config.maxAnalysesPerOrg)
  } catch (error) {
    if (error instanceof Error && error.message === 'DEMO_ANALYSIS_LIMIT') {
      return NextResponse.json({ error: 'DEMO_ANALYSIS_LIMIT' }, { status: 403 })
    }
    throw error
  }
  await touchOrgActivity(scope.activeOrgId).catch(() => {})
  if (!result.alreadyExisted) {
    await auditLog('ANALYSE_CREATED', {
      userId, ip: getClientIp(req),
      targetType: 'analyse', targetId: result.id,
      details: { demoExample: true, orgId: scope.activeOrgId },
    })
  }
  return NextResponse.json({ ok: true, analyseId: result.id, alreadyExisted: result.alreadyExisted })
})

// Le contrôle d'instance démo précède l'authentification (403 même sans session, comme avant).
// Route sans paramètre dynamique : le contexte de route n'est pas transmis.
export async function POST(req: Request) {
  if (!(await isDemoInstance())) {
    return NextResponse.json({ error: 'Instance non démo' }, { status: 403 })
  }
  return chargerExemple(req instanceof NextRequest ? req : new NextRequest(req))
}
