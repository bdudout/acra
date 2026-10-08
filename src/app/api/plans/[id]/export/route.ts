// ─── Programme d'audit et de contrôle : export Excel d'un plan (lot P6) ───────
// Présentation, une feuille par année (cibles nommées, statut calculé, réalisations), historique des validations.
// Lecture globale du dispositif ; débit limité ; export journalisé.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contextePlan, chargerPlan, donneesRealisations, etatRealisation, nomsCibles } from '@/lib/planification.server'
import { cleanRealisations, statutLigne } from '@/lib/planification'
import { buildPlanXlsx, type LigneExport } from '@/lib/planification-xlsx'
import { getT } from '@/lib/i18n'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_EXPORT } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }
const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const c = await contextePlan()
  if ('error' in c) return c.error
  const plan = await chargerPlan((await params).id, c)
  if (!plan) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const rl = await rateLimit(`plans-export:${c.userId}`, LIMIT_EXPORT.limit, LIMIT_EXPORT.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  const [annees, lignes, donnees, noms, org] = await Promise.all([
    prisma.planAnnee.findMany({ where: { planId: plan.id }, orderBy: { annee: 'asc' } }),
    prisma.planLigne.findMany({ where: { planId: plan.id }, orderBy: [{ annee: 'asc' }, { debut: 'asc' }, { intitule: 'asc' }] }),
    donneesRealisations(c.orgId), nomsCibles(c.orgId),
    prisma.organization.findUnique({ where: { id: c.orgId }, select: { nom: true } }),
  ])
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const lang = req.nextUrl.searchParams.get('lang') ?? 'fr'
  const buf = await buildPlanXlsx({
    t: getT(lang), now: new Date(), organisation: org?.nom ?? '',
    plan, noms,
    annees: annees.map(a => ({ annee: a.annee, statut: a.statut, valideLe: a.valideLe ? a.valideLe.toISOString() : null, revision: a.revision, motifRevision: a.motifRevision, commentaire: a.commentaire })),
    lignes: lignes.map(l => {
      const realisations = cleanRealisations(l.realisations).map(r => etatRealisation(r, l.annee, donnees)).filter((x): x is NonNullable<typeof x> => !!x)
      return { ...l, cibles: (l.cibles ?? {}) as LigneExport['cibles'], echantillon: l.echantillon as LigneExport['echantillon'], debut: jour(l.debut), fin: jour(l.fin), realisations,
        statutCalcule: statutLigne({ debut: jour(l.debut), fin: jour(l.fin), statutManuel: l.statutManuel }, realisations, aujourdhui) }
    }),
  })
  await auditLog('EXPORT', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), targetType: 'plan', targetId: plan.id, details: { format: 'xlsx' } })
  const fichier = `plan-${plan.nom.normalize('NFD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'audit-controle'}.xlsx`
  return new NextResponse(buf as unknown as BodyInit, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${fichier}"`, 'Cache-Control': 'no-store' } })
}
