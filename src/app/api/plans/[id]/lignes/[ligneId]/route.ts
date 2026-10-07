// ─── Programme d'audit et de contrôle : modification / suppression d'une ligne ──
// Mêmes règles que l'ajout : préparateur, année modifiable selon le mode du plan.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contextePlan, chargerPlan, type ContextePlan } from '@/lib/planification.server'
import { cleanLigneInput, peutModifierLignes, peutPreparer, type ModePlan, type Prisme, type StatutAnnee, type TypePlan } from '@/lib/planification'
import { auditLog, getClientIp } from '@/lib/logger'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string; ligneId: string }> }

type Charge = { error: NextResponse } | { plan: NonNullable<Awaited<ReturnType<typeof chargerPlan>>>; ligne: NonNullable<Awaited<ReturnType<typeof prisma.planLigne.findFirst>>> }

async function charger(id: string, ligneId: string, c: ContextePlan): Promise<Charge> {
  const plan = await chargerPlan(id, c)
  if (!plan) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  const ligne = await prisma.planLigne.findFirst({ where: { id: ligneId, planId: plan.id } })
  if (!ligne) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }
  if (!peutPreparer(c.role, plan.type as TypePlan, c.cfg)) return { error: NextResponse.json({ error: 'role_preparateur_requis' }, { status: 403 }) }
  const annee = await prisma.planAnnee.findUnique({ where: { planId_annee: { planId: plan.id, annee: ligne.annee } } })
  if (!annee || !peutModifierLignes(annee.statut as StatutAnnee, plan.mode as ModePlan)) return { error: NextResponse.json({ error: 'annee_verrouillee' }, { status: 409 }) }
  return { plan, ligne }
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const c = await contextePlan()
  if ('error' in c) return c.error
  const { id, ligneId } = await params
  const x = await charger(id, ligneId, c)
  if ('error' in x) return x.error as NextResponse
  const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
  // Champs absents : valeurs actuelles (une ligne reste dans son année).
  const r = cleanLigneInput({ ...x.ligne, debut: jour(x.ligne.debut), fin: jour(x.ligne.fin), ...(await req.json().catch(() => ({}))) }, x.ligne.annee, x.plan.prismePrincipal as Prisme)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  const { debut, fin, cibles, echantillon, ...reste } = r.ligne
  const ligne = await prisma.planLigne.update({ where: { id: x.ligne.id }, data: {
    ...reste, cibles: cibles as unknown as Prisma.InputJsonValue,
    echantillon: (echantillon ?? null) as unknown as Prisma.InputJsonValue,
    debut: debut ? new Date(`${debut}T00:00:00Z`) : null, fin: fin ? new Date(`${fin}T00:00:00Z`) : null,
  } })
  await auditLog('PLAN_PROGRAMME_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), targetType: 'plan', targetId: x.plan.id, details: { action: 'ligne_update', ligne: ligne.id } })
  return NextResponse.json(ligne)
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const c = await contextePlan()
  if ('error' in c) return c.error
  const { id, ligneId } = await params
  const x = await charger(id, ligneId, c)
  if ('error' in x) return x.error as NextResponse
  await prisma.planLigne.delete({ where: { id: x.ligne.id } })
  await auditLog('PLAN_PROGRAMME_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), targetType: 'plan', targetId: x.plan.id, details: { action: 'ligne_delete', ligne: x.ligne.id } })
  return NextResponse.json({ ok: true })
}
