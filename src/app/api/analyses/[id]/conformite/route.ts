import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { analyseAccessWhere } from '@/lib/org-context.server'
import { canEditAnalyse } from '@/lib/permissions'
import {
  sanitizeConformite,
  applyConformiteStatut,
  conformiteStats,
  CONFORMITE_STATUTS,
  type ConformiteStatut,
} from '@/lib/conformite'
import { getFrameworkControles } from '@/lib/frameworks-data'
import { getServerLocale } from '@/lib/i18n'
import { getOrgConfig } from '@/lib/org-config.server'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

/**
 * PATCH /api/analyses/[id]/conformite
 *
 * Met à jour le statut d'UN contrôle du socle de sécurité (Cadrage.socleSecurite)
 * sans passer par l'atelier 1 — pour l'édition inline depuis le dashboard (suivi de
 * conformité). Body : { ref: string, statut: 'conforme'|'partiel'|'non_conforme'|'na' }.
 *
 * Requiert : session valide (401), sous rate-limit écriture (429), droit d'ÉDITION
 * sur l'analyse (403), conformité activée pour l'org (403), analyse non approuvée
 * sauf ADMIN (403), et un cadrage existant (400). Ne touche que le champ
 * socleSecurite (fusion par ref). Renvoie les statistiques de conformité à jour.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id: analyseId } = await params
  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  // Rate-limiting écriture (defense-in-depth), aligné sur les autres endpoints d'écriture.
  const rl = rateLimit(`conformite:${userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Trop de requêtes. Réessayez dans un instant.' },
      { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
    )
  }

  const analyse = await prisma.analyse.findFirst({
    where: await analyseAccessWhere(userId, userRole, analyseId),
    include: { accesUtilisateurs: true, cadrage: { select: { socleSecurite: true, customControles: true } } },
  })
  if (!analyse || analyse.deletedAt) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })

  // Cohérence : refuser l'édition si la fonctionnalité conformité est désactivée pour l'org.
  const orgConfig = await getOrgConfig((analyse as any).organizationId)
  if (!orgConfig.conformiteActive) {
    return NextResponse.json({ error: 'Fonctionnalité de conformité désactivée' }, { status: 403 })
  }

  if (!canEditAnalyse({ id: userId, role: userRole }, { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs })) {
    return NextResponse.json({ error: 'Accès refusé — édition non autorisée' }, { status: 403 })
  }
  if (analyse.statut === 'APPROUVE' && userRole !== 'ADMIN') {
    return NextResponse.json({ error: 'L\'analyse est approuvée et ne peut plus être modifiée' }, { status: 403 })
  }
  if (!analyse.cadrage) return NextResponse.json({ error: 'Cadrage inexistant' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const ref = String(body?.ref ?? '').trim()
  const statut = body?.statut as ConformiteStatut
  if (!ref || !(CONFORMITE_STATUTS as string[]).includes(statut)) {
    return NextResponse.json({ error: 'Requête invalide (ref/statut)' }, { status: 400 })
  }

  const locale = await getServerLocale()
  const ref_ = (analyse as any).referentielMesures ?? 'ISO27001'
  const controles = getFrameworkControles(ref_, (analyse.cadrage as any).customControles as any[], locale)
  const validRefs = new Set(controles.map(c => c.ref))
  // Refuser un contrôle inexistant dans le référentiel (defense-in-depth).
  if (!validRefs.has(ref)) return NextResponse.json({ error: 'Contrôle inconnu du référentiel' }, { status: 400 })

  const current = sanitizeConformite((analyse.cadrage as any).socleSecurite, validRefs)
  const updated = applyConformiteStatut(current, ref, statut)

  await prisma.cadrage.update({
    where: { analyseId },
    data: { socleSecurite: updated as unknown as object },
  })
  await prisma.analyse.update({ where: { id: analyseId }, data: { updatedAt: new Date() } })

  return NextResponse.json({ ok: true, stats: conformiteStats(updated, controles.length) })
}
