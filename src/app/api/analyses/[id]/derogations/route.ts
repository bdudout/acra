import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { analyseAccessWhere } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { canEditAnalyse, type UserRole } from '@/lib/permissions'
import { validateDerogationInput } from '@/lib/derogation'
import { auditLog, getClientIp } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

async function loadAnalyse(userId: string, userRole: UserRole, id: string) {
  return prisma.analyse.findFirst({
    where: await analyseAccessWhere(userId, userRole, id),
    select: { id: true, organizationId: true, userId: true, deletedAt: true, accesUtilisateurs: true },
  })
}

// GET /api/analyses/[id]/derogations — liste des dérogations de l'analyse.
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const { id } = await params
  const analyse = await loadAnalyse(userId, userRole, id)
  if (!analyse || analyse.deletedAt) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const orgConfig = await getOrgConfig(analyse.organizationId)
  const derogations = await prisma.derogation.findMany({
    where: { analyseId: id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({
    derogations,
    config: {
      dureeDefautJours: orgConfig.derogationDureeDefautJours,
      alerteJours: orgConfig.derogationAlerteJours,
      active: orgConfig.derogationsActive,
    },
  })
}

// POST /api/analyses/[id]/derogations — créer une demande de dérogation (porteur).
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const { id } = await params
  const analyse = await loadAnalyse(userId, userRole, id)
  if (!analyse || analyse.deletedAt) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const orgConfig = await getOrgConfig(analyse.organizationId)
  if (!orgConfig.derogationsActive) {
    return NextResponse.json({ error: 'Les dérogations ne sont pas activées pour cette organisation' }, { status: 403 })
  }
  if (!canEditAnalyse({ id: userId, role: userRole }, { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs })) {
    return NextResponse.json({ error: 'Accès refusé — seul le porteur peut demander une dérogation' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const input = {
    portee: String(body.portee ?? ''),
    referentiel: body.referentiel != null ? String(body.referentiel) : null,
    ref: body.ref != null ? String(body.ref) : null,
    risqueId: body.risqueId != null ? String(body.risqueId) : null,
    intitule: body.intitule != null ? String(body.intitule).slice(0, 255) : null,
    motif: body.motif != null ? String(body.motif).slice(0, 5000) : null,
    mesuresCompensatoires: body.mesuresCompensatoires != null ? String(body.mesuresCompensatoires).slice(0, 5000) : null,
  }
  const erreur = validateDerogationInput(input)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })

  // Si la portée cible un risque, vérifier qu'il appartient bien à l'analyse.
  if (input.portee === 'RISQUE') {
    const risque = await prisma.risque.findFirst({ where: { id: input.risqueId!, analyseId: id }, select: { id: true } })
    if (!risque) return NextResponse.json({ error: 'Risque introuvable dans cette analyse' }, { status: 400 })
  }

  const derogation = await prisma.derogation.create({
    data: {
      organizationId: analyse.organizationId ?? 'global',
      analyseId: id,
      portee: input.portee,
      referentiel: input.portee === 'CONTROLE' ? input.referentiel : null,
      ref: input.portee === 'CONTROLE' ? input.ref : null,
      risqueId: input.portee === 'RISQUE' ? input.risqueId : null,
      intitule: input.intitule!,
      motif: input.motif!,
      mesuresCompensatoires: input.mesuresCompensatoires!,
      demandeurId: userId,
      statut: 'DEMANDEE',
    },
  })
  await auditLog('DEROGATION_REQUESTED', {
    userId, userRole, targetId: derogation.id, targetType: 'derogation', ip: getClientIp(req),
    details: { analyseId: id, portee: input.portee, intitule: input.intitule },
  })
  return NextResponse.json(derogation, { status: 201 })
}
