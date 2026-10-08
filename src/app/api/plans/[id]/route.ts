// ─── Programme d'audit et de contrôle : un plan ───────────────────────────────
// GET : plan, années (statut, contenu figé, historique) et lignes. PATCH : nom, équipe, prisme, mode, horizon (préparateur ;
// un horizon réduit ne doit pas écarter d'année qui a des lignes ou une validation). DELETE : seulement si aucune année
// n'a été validée (la trace d'un plan validé est conservée).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contextePlan, chargerPlan, assurerAnnees, donneesRealisations, etatRealisation } from '@/lib/planification.server'
import { cleanPlanInput, cleanRealisations, peutPreparer, peutValider, statutLigne, type TypePlan } from '@/lib/planification'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const c = await contextePlan()
  if ('error' in c) return c.error
  const plan = await chargerPlan((await params).id, c)
  if (!plan) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const [annees, lignes] = await Promise.all([
    prisma.planAnnee.findMany({ where: { planId: plan.id }, orderBy: { annee: 'asc' } }),
    prisma.planLigne.findMany({ where: { planId: plan.id }, orderBy: [{ annee: 'asc' }, { debut: 'asc' }, { intitule: 'asc' }] }),
  ])
  const type = plan.type as TypePlan
  // Statut calculé de chaque ligne (réalisations rattachées, période) et état des réalisations (lot P4).
  const donnees = await donneesRealisations(c.orgId)
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const jour = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : null)
  const enrichies = lignes.map(l => {
    const realisations = cleanRealisations(l.realisations).map(r => ({ ...r, ...(etatRealisation(r, l.annee, donnees) ?? { statut: null, intitule: null }) }))
    return { ...l, realisations, statutCalcule: statutLigne({ debut: jour(l.debut), fin: jour(l.fin), statutManuel: l.statutManuel }, realisations.filter(r => r.statut).map(r => ({ statut: r.statut! })), aujourdhui) }
  })
  return NextResponse.json({ plan, annees, lignes: enrichies, droits: { preparer: peutPreparer(c.role, type, c.cfg), valider: peutValider(c.role, type, c.cfg), doubleRegard: c.cfg.doubleRegard } })
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const c = await contextePlan()
  if ('error' in c) return c.error
  const plan = await chargerPlan((await params).id, c)
  if (!plan) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (!peutPreparer(c.role, plan.type as TypePlan, c.cfg)) return NextResponse.json({ error: 'role_preparateur_requis' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  // Le type d'un plan ne change pas ; les champs absents gardent leur valeur.
  const r = cleanPlanInput({ ...plan, ...body, type: plan.type }, plan.mode as 'FIGE' | 'DYNAMIQUE')
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  const horsHorizon = await prisma.planAnnee.count({
    where: { planId: plan.id, OR: [{ annee: { lt: r.plan.anneeDebut } }, { annee: { gt: r.plan.anneeFin } }], AND: [{ OR: [{ statut: { not: 'BROUILLON' } }, { revision: { gt: 0 } }] }] },
  }) + await prisma.planLigne.count({ where: { planId: plan.id, OR: [{ annee: { lt: r.plan.anneeDebut } }, { annee: { gt: r.plan.anneeFin } }] } })
  if (horsHorizon) return NextResponse.json({ error: 'horizon_exclut_annees_utilisees' }, { status: 409 })
  const maj = await prisma.planProgramme.update({ where: { id: plan.id }, data: { nom: r.plan.nom, equipe: r.plan.equipe, prismePrincipal: r.plan.prismePrincipal, mode: r.plan.mode, anneeDebut: r.plan.anneeDebut, anneeFin: r.plan.anneeFin, description: r.plan.description } })
  await prisma.planAnnee.deleteMany({ where: { planId: plan.id, OR: [{ annee: { lt: r.plan.anneeDebut } }, { annee: { gt: r.plan.anneeFin } }] } })
  await assurerAnnees(plan.id, r.plan.anneeDebut, r.plan.anneeFin)
  await auditLog('PLAN_PROGRAMME_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), targetType: 'plan', targetId: plan.id, details: { action: 'update' } })
  return NextResponse.json(maj)
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const c = await contextePlan()
  if ('error' in c) return c.error
  const plan = await chargerPlan((await params).id, c)
  if (!plan) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (!peutPreparer(c.role, plan.type as TypePlan, c.cfg)) return NextResponse.json({ error: 'role_preparateur_requis' }, { status: 403 })
  if (await prisma.planAnnee.count({ where: { planId: plan.id, OR: [{ statut: 'VALIDE' }, { revision: { gt: 0 } }] } })) {
    return NextResponse.json({ error: 'plan_deja_valide' }, { status: 409 })
  }
  await prisma.planProgramme.delete({ where: { id: plan.id } })
  await auditLog('PLAN_PROGRAMME_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), targetType: 'plan', targetId: plan.id, details: { action: 'delete' } })
  return NextResponse.json({ ok: true })
}
