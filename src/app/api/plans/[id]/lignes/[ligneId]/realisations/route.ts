// ─── Programme d'audit et de contrôle : réalisations rattachées à une ligne (lot P4) ─
// GET : réalisations rattachées (état pour l'année), propositions (processus ou risques en commun, période dans
// l'année) et candidats de l'année. PUT { realisations: [{ type, id }] } : préparateur ; possible même sur une année
// validée (on trace l'exécution, le contenu figé du plan ne change pas) ; chaque identifiant doit exister dans
// l'organisation. Logique : lib/planification (statutLigne, suggererRealisations).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contextePlan, chargerPlan, donneesRealisations, etatRealisation, candidatsRealisation } from '@/lib/planification.server'
import { cleanRealisations, peutPreparer, statutLigne, suggererRealisations, type TypePlan } from '@/lib/planification'
import { auditLog, getClientIp } from '@/lib/logger'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string; ligneId: string }> }
const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const c = await contextePlan()
  if ('error' in c) return c.error
  const { id, ligneId } = await params
  const plan = await chargerPlan(id, c)
  const ligne = plan && await prisma.planLigne.findFirst({ where: { id: ligneId, planId: plan.id } })
  if (!plan || !ligne) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const d = await donneesRealisations(c.orgId)
  const rattachees = cleanRealisations(ligne.realisations).map(r => ({ ...r, ...(etatRealisation(r, ligne.annee, d) ?? { statut: null, intitule: null }) }))
  const candidats = candidatsRealisation(ligne.annee, d).filter(x => !x.debut || x.debut.slice(0, 4) <= String(ligne.annee))
  const cibles = (ligne.cibles ?? {}) as { processus?: string[]; risques?: string[] }
  return NextResponse.json({
    rattachees,
    propositions: suggererRealisations({ debut: jour(ligne.debut), fin: jour(ligne.fin), cibles }, ligne.annee, candidats).slice(0, 20),
    candidats: candidats.filter(x => !x.debut || (x.fin ?? x.debut) >= `${ligne.annee}-01-01`).slice(0, 500),
    statut: statutLigne({ debut: jour(ligne.debut), fin: jour(ligne.fin), statutManuel: ligne.statutManuel }, rattachees.filter(r => r.statut).map(r => ({ statut: r.statut! })), new Date().toISOString().slice(0, 10)),
    peutModifier: peutPreparer(c.role, plan.type as TypePlan, c.cfg),
  })
}

export async function PUT(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const c = await contextePlan()
  if ('error' in c) return c.error
  const { id, ligneId } = await params
  const plan = await chargerPlan(id, c)
  const ligne = plan && await prisma.planLigne.findFirst({ where: { id: ligneId, planId: plan.id } })
  if (!plan || !ligne) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (!peutPreparer(c.role, plan.type as TypePlan, c.cfg)) return NextResponse.json({ error: 'role_preparateur_requis' }, { status: 403 })
  const realisations = cleanRealisations(((await req.json().catch(() => ({}))) as { realisations?: unknown }).realisations)
  const d = await donneesRealisations(c.orgId)
  if (realisations.some(r => !etatRealisation(r, ligne.annee, d))) return NextResponse.json({ error: 'realisation_introuvable' }, { status: 400 })
  await prisma.planLigne.update({ where: { id: ligne.id }, data: { realisations: realisations as unknown as Prisma.InputJsonValue } })
  await auditLog('PLAN_PROGRAMME_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), targetType: 'plan', targetId: plan.id, details: { action: 'realisations', ligne: ligne.id, nombre: realisations.length } })
  return NextResponse.json({ ok: true, realisations })
}
