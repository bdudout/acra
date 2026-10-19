// ─── Lier une analyse cyber existante à un projet 360 ─────────────────────────
// POST { analyseId } : Analyse.projetSourceId ← projet. Il faut pouvoir MODIFIER le projet (guardDirectRisk) ET
// l'analyse cyber (propriétaire ou accès en édition) ; l'analyse doit être accessible, cyber et de la même
// organisation (filtre commun lib/projet360-sources). La création d'une nouvelle analyse liée passe par
// /analyses/new?projet=<id>.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canEditAnalyse, resolveAnalyseRole } from '@/lib/permissions'
import { guardDirectRisk } from '@/lib/analyse-direct-risk.server'
import { sourcesCyberWhere } from '@/lib/projet360-sources.server'
import { getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { getOrgConfig } from '@/lib/org-config.server'
import { withAccess } from '@/lib/with-access.server'

export const dynamic = 'force-dynamic'
// Garde déléguée à guardDirectRisk (rôle effectif dans l'organisation du projet) → `org: 'none'`.
export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'projet-analyses' } }, async (req, { user: u, params }) => {
  const role = u.role
  const g = await guardDirectRisk(params.id, u.id, role)
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const orgId = g.analyse.organizationId
  if (g.analyse.methode !== 'PROJET_360' || !orgId) return NextResponse.json({ error: 'methode_non_360' }, { status: 400 })
  // Module Projets 360 désactivé : aucun lien possible (les boutons sont déjà masqués, l'API ne doit pas le permettre).
  if (!(await getOrgConfig(orgId)).projets360Active) return NextResponse.json({ error: 'module_inactif' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as { analyseId?: unknown }
  const analyseId = typeof body.analyseId === 'string' ? body.analyseId : ''
  const cible = analyseId ? await prisma.analyse.findFirst({
    where: { ...(await sourcesCyberWhere(u.id, role, { id: g.analyse.id, organizationId: orgId })), id: analyseId },
    select: { id: true, nom: true, userId: true, accesUtilisateurs: true },
  }) : null
  if (!cible) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })
  const effRole = resolveAnalyseRole(role, orgId, await getEffectiveRoleForOrg(u.id, role, orgId))
  if (!canEditAnalyse({ id: u.id, role: effRole }, { userId: cible.userId, accesUtilisateurs: cible.accesUtilisateurs })) {
    return NextResponse.json({ error: 'Édition de l’analyse non autorisée' }, { status: 403 })
  }
  await prisma.analyse.update({ where: { id: cible.id }, data: { projetSourceId: g.analyse.id } })
  await auditLog('WORKSHOP_SAVED', {
    userId: u.id, userRole: effRole, organizationId: orgId, targetId: g.analyse.id, targetType: 'analyse', ip: getClientIp(req),
    details: { scope: 'projet-analyse-cyber', action: 'lier', analyseId: cible.id },
  })
  return NextResponse.json({ ok: true, analyse: { id: cible.id, nom: cible.nom } })
})
