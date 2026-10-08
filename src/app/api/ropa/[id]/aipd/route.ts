// ─── Suivi de l'AIPD d'un traitement (RGPD art. 35-36) ────────────────────────
// PATCH : statut, analyse ACRA rattachée (de l'organisation active), date, justification, consultation préalable.
// « Non retenue » sans justification refusée dès qu'un critère WP248 est présent. DPO / ADMIN ; journalisé.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { canManageRopa, type UserRole } from '@/lib/permissions'
import { evaluerTraitement, sanitizeTraitement } from '@/lib/ropa'
import { sanitizeSuiviAipd, validerSuiviAipd } from '@/lib/ropa-aipd'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const user = session.user as { id: string; role?: string }
  const scope = await getAnalyseScope(user.id, (user.role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  if (!canManageRopa(scope.role as UserRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })

  const traitement = await prisma.traitement.findFirst({ where: { id, organizationId: scope.activeOrgId } })
  if (!traitement) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const suivi = sanitizeSuiviAipd(await req.json().catch(() => ({})))
  const erreur = validerSuiviAipd(evaluerTraitement(sanitizeTraitement(traitement)).pia.niveau, suivi)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  if (suivi.aipdAnalyseId && !(await prisma.analyse.findFirst({ where: { id: suivi.aipdAnalyseId, organizationId: scope.activeOrgId, deletedAt: null }, select: { id: true } }))) {
    return NextResponse.json({ error: 'analyse_invalide' }, { status: 400 })
  }
  const maj = await prisma.traitement.update({ where: { id }, data: suivi })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: user.id, userRole: scope.role, organizationId: scope.activeOrgId, ip: getClientIp(req), details: { scope: 'ropa', action: 'aipd', id, statut: suivi.aipdStatut } })
  return NextResponse.json(maj)
}
