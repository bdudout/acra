import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canViewAnalyse, canEditAnalyse, analyseWhereClause } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { sanitizeQualification } from '@/lib/qualification'

type Params = { params: Promise<{ id: string }> }

async function loadAnalyse(id: string) {
  return prisma.analyse.findUnique({
    where: { id },
    include: { accesUtilisateurs: true },
  })
}

// GET /api/analyses/:id — détail complet
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  const analyse = await prisma.analyse.findUnique({
    where: { id },
    include: {
      cadrage: true,
      sourcesRisque: true,
      partiesPrenantes: true,
      scenariosStrategiques: true,
      scenariosOperationnels: true,
      risques: true,
      mesures: true,
      accesUtilisateurs: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
    },
  })

  if (!analyse) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })

  if (!canViewAnalyse({ id: userId, role: userRole }, { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs })) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Indiquer au client si l'utilisateur peut éditer
  const editable = canEditAnalyse({ id: userId, role: userRole }, { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs })

  return NextResponse.json({ analyse, editable })
}

// PATCH /api/analyses/:id — modifier les infos générales ou le statut
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  const existing = await loadAnalyse(id)
  if (!existing) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })

  if (!canEditAnalyse({ id: userId, role: userRole }, { userId: existing.userId, accesUtilisateurs: existing.accesUtilisateurs })) {
    return NextResponse.json({ error: 'Accès refusé — édition non autorisée' }, { status: 403 })
  }

  const body = await req.json()
  const allowed = ['nom', 'description', 'organisation', 'secteur', 'atelierCourant', 'dateEcheance', 'referentielMesures', 'isSocle']
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
  }
  // statut seulement si EN_COURS→TERMINE (pas les statuts d'approbation qui passent par /approbation)
  if (body.statut === 'TERMINE' || body.statut === 'EN_COURS' || body.statut === 'ARCHIVE') {
    data.statut = body.statut
  }
  // Questionnaire de qualification (optionnel) — filtré aux questions connues
  if ('qualification' in body) {
    data.qualification = sanitizeQualification(body.qualification)
  }

  const updated = await prisma.analyse.update({ where: { id }, data })
  return NextResponse.json({ analyse: updated })
}

// DELETE /api/analyses/:id — seul le propriétaire ou ADMIN peut supprimer
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  const existing = await loadAnalyse(id)
  if (!existing) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })

  // Seul le propriétaire ou un ADMIN peut supprimer
  if (existing.userId !== userId && userRole !== 'ADMIN') {
    return NextResponse.json({ error: 'Seul le propriétaire peut supprimer cette analyse' }, { status: 403 })
  }

  await prisma.analyse.delete({ where: { id } })
  await auditLog('ANALYSE_DELETED', {
    userId, userRole,
    targetId: id, targetType: 'analyse',
    ip: getClientIp(req),
    details: { nom: existing.nom },
  })
  return NextResponse.json({ ok: true })
}
