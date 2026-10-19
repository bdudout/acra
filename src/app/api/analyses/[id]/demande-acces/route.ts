import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { analyseAccessWhere, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { canViewAnalyse, resolveAnalyseRole } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { getSmtpSettings, isUsable, sendEmail } from '@/lib/email'
import { demandeAccesAnalyseEmail } from '@/lib/email-i18n'
import { appUrl } from '@/lib/org-invitation.server'

// ─── Demande d'accès à une analyse (n° 63) ───────────────────────────────────
// Un membre de l'organisation à qui la règle de visibilité (celle de la liste) refuse une
// analyse demande l'accès à son propriétaire. Pas de garde `{ analyse }` de withAccess : elle
// refuse justement cette analyse (403 ACCES_ANALYSE_REFUSE) ; le périmètre d'organisation est
// appliqué ici avec `analyseAccessWhere` (hors périmètre → 404, aucune divulgation).
// La demande est journalisée ; l'e-mail part si la messagerie est configurée.
export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'demande-acces', limit: 5, windowMs: 60 * 60_000 } }, async (req, { user, params }) => {
  const id = params.id
  const analyse = id
    ? await prisma.analyse.findFirst({
        where: await analyseAccessWhere(user.id, user.role, id),
        select: { id: true, nom: true, organizationId: true, userId: true, statut: true, deletedAt: true, accesUtilisateurs: { select: { userId: true, permission: true } } },
      })
    : null
  if (!analyse || analyse.deletedAt) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const role = resolveAnalyseRole(user.role, analyse.organizationId, await getEffectiveRoleForOrg(user.id, user.role, analyse.organizationId))
  if (canViewAnalyse({ id: user.id, role }, analyse)) return NextResponse.json({ error: 'DEJA_ACCES' }, { status: 400 })

  const proprietaire = await prisma.user.findUnique({ where: { id: analyse.userId }, select: { id: true, email: true, locale: true, isActive: true } })
  let notifie = false
  if (proprietaire?.isActive && proprietaire.email && isUsable(await getSmtpSettings())) {
    const lien = appUrl(`/analyses/${analyse.id}`) ?? `/analyses/${analyse.id}`
    const moi = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true } })
    const demandeur = moi?.name ? `${moi.name} (${moi.email})` : (moi?.email ?? user.id)
    const mail = demandeAccesAnalyseEmail(proprietaire.locale, { analyseNom: analyse.nom, demandeur, lien })
    const res = await sendEmail({ to: proprietaire.email, subject: mail.subject, text: mail.text, html: mail.html })
    notifie = res.ok
  }

  await auditLog('ANALYSE_ACCES_DEMANDE', {
    userId: user.id, userRole: role, organizationId: analyse.organizationId, ip: getClientIp(req),
    targetId: analyse.id, targetType: 'analyse', details: { proprietaireId: analyse.userId, notifie },
  })
  return NextResponse.json({ ok: true, notifie })
})
