// ─── Suivi de l'AIPD d'un traitement (RGPD art. 35-36) ────────────────────────
// PATCH : statut, analyse ACRA rattachée (de l'organisation active), date, justification, consultation préalable.
// « Non retenue » sans justification refusée dès qu'un critère WP248 est présent. DPO / ADMIN ; journalisé.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canManageRopa } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { evaluerTraitement, sanitizeTraitement } from '@/lib/ropa'
import { sanitizeSuiviAipd, validerSuiviAipd } from '@/lib/ropa-aipd'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export const PATCH = withAccess({ org: 'active', allow: canManageRopa, rateLimit: { bucket: 'ropa' } }, async (req, { user, role, orgId, params: { id } }) => {
  const traitement = await prisma.traitement.findFirst({ where: { id, organizationId: orgId } })
  if (!traitement) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const suivi = sanitizeSuiviAipd(await req.json().catch(() => ({})))
  const erreur = validerSuiviAipd(evaluerTraitement(sanitizeTraitement(traitement)).pia.niveau, suivi)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })
  if (suivi.aipdAnalyseId && !(await prisma.analyse.findFirst({ where: { id: suivi.aipdAnalyseId, organizationId: orgId, deletedAt: null }, select: { id: true } }))) {
    return NextResponse.json({ error: 'analyse_invalide' }, { status: 400 })
  }
  const maj = await prisma.traitement.update({ where: { id }, data: suivi })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), details: { scope: 'ropa', action: 'aipd', id, statut: suivi.aipdStatut } })
  return NextResponse.json(maj)
})
