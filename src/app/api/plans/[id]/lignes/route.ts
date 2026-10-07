// ─── Programme d'audit et de contrôle : ajout d'une ligne à une année du plan ──
// Préparateur ; l'année doit être modifiable (plan figé : brouillon ou révision ; dynamique : hors soumission).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contextePlan, chargerPlan } from '@/lib/planification.server'
import { cleanLigneInput, peutModifierLignes, peutPreparer, type ModePlan, type Prisme, type StatutAnnee, type TypePlan } from '@/lib/planification'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, LIMIT_API_WRITE } from '@/lib/rate-limit'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'
type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const c = await contextePlan()
  if ('error' in c) return c.error
  const plan = await chargerPlan((await params).id, c)
  if (!plan) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (!peutPreparer(c.role, plan.type as TypePlan, c.cfg)) return NextResponse.json({ error: 'role_preparateur_requis' }, { status: 403 })
  const rl = await rateLimit(`plans:${c.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const annee = await prisma.planAnnee.findUnique({ where: { planId_annee: { planId: plan.id, annee: Number(body.annee) } } })
  if (!annee) return NextResponse.json({ error: 'annee_hors_horizon' }, { status: 400 })
  if (!peutModifierLignes(annee.statut as StatutAnnee, plan.mode as ModePlan)) return NextResponse.json({ error: 'annee_verrouillee' }, { status: 409 })
  const r = cleanLigneInput(body, annee.annee, plan.prismePrincipal as Prisme)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  const { debut, fin, cibles, echantillon, ...reste } = r.ligne
  const ligne = await prisma.planLigne.create({ data: {
    ...reste, planId: plan.id, annee: annee.annee, cibles: cibles as unknown as Prisma.InputJsonValue,
    echantillon: (echantillon ?? undefined) as Prisma.InputJsonValue | undefined,
    debut: debut ? new Date(`${debut}T00:00:00Z`) : null, fin: fin ? new Date(`${fin}T00:00:00Z`) : null,
  } })
  await auditLog('PLAN_PROGRAMME_UPDATED', { userId: c.userId, userRole: c.role, organizationId: c.orgId, ip: getClientIp(req), targetType: 'plan', targetId: plan.id, details: { action: 'ligne_create', annee: annee.annee, ligne: ligne.id } })
  return NextResponse.json(ligne, { status: 201 })
}
