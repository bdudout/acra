import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { elementsATraiter } from '@/lib/relances.server'
import { libelleEtat, libellePhaseDeclaration, libelleRelance } from '@/lib/email-i18n'
import { declarationsATraiter } from '@/lib/declarations-a-traiter.server'
import { getT } from '@/lib/i18n'
import { resolveOrgContext } from '@/lib/org-context.server'
import type { UserRole } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

/**
 * GET /api/a-traiter — ce qui attend la personne connectée (moteur des relances en aperçu : mêmes règles et destinataires
 * que l'e-mail quotidien, sans envoi ni marquage). Libellés dans sa langue. `?compte=1` : total et nombre en retard (menu).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, locale: true } })
  if (!user?.email) return NextResponse.json({ total: 0, enRetard: 0, items: [] })
  const [relances, declarations] = await Promise.all([elementsATraiter(user.email), declarationsATraiter(userId)])
  // Déclarations d'incident non soumises (DORA, NIS2, RGPD…) : en retard, ou à faire (échéance proche par nature : heures / jours).
  const t = getT(user.locale ?? 'fr')
  const decl = declarations.map(d => {
    const type = d.statut === 'EN_RETARD' ? 'EN_RETARD' as const : 'ECHEANCE_PROCHE' as const
    const echeance = d.echeance.toISOString().slice(0, 10)
    return { categorie: 'DECLARATION_INCIDENT', intitule: `${d.incident} — ${libellePhaseDeclaration(user.locale, d)}`, type, echeance, organisationId: d.organisationId, organisation: d.organisation, lien: '/incidents', libelleCategorie: t.aTraiter.declaration, etat: libelleEtat(user.locale, type, echeance) }
  })
  const enRetard = relances.filter(i => i.type === 'EN_RETARD').length + decl.filter(d => d.type === 'EN_RETARD').length
  const total = relances.length + decl.length
  if (req.nextUrl.searchParams.get('compte') === '1') return NextResponse.json({ total, enRetard })
  const URG: Record<string, number> = { EN_RETARD: 0, EN_ATTENTE: 1, ECHEANCE_PROCHE: 2, PERIODIQUE: 3 }
  const items = [...decl, ...relances.map(i => { const l = libelleRelance(user.locale, i); return { ...i, libelleCategorie: l.categorie, etat: l.etat } })]
    .sort((a, b) => URG[a.type] - URG[b.type] || (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999'))
  // Organisation active : un élément d'une autre organisation y bascule au clic (recette n° 21).
  const { activeOrgId } = await resolveOrgContext(userId, ((session.user as { role?: UserRole }).role ?? 'ANALYSTE'))
  return NextResponse.json({ total, enRetard, items, activeOrgId: activeOrgId ?? null })
}
