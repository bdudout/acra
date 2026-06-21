import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { analyseAccessWhere } from '@/lib/org-context.server'
import { NextRequest, NextResponse } from 'next/server'
import { canSubmitAnalyse, canApproveAnalyse } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'

type Params = { params: Promise<{ id: string }> }

// POST /api/analyses/[id]/approbation
// body: { action: 'SOUMETTRE' | 'APPROUVER' | 'REJETER', commentaire?: string }
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  const analyse = await prisma.analyse.findFirst({
    where: await analyseAccessWhere(userId, userRole, id),
    include: { accesUtilisateurs: true },
  })
  if (!analyse || analyse.deletedAt) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const { action, commentaire } = await req.json() as {
    action: 'SOUMETTRE' | 'APPROUVER' | 'REJETER'
    commentaire?: string
  }

  const ownership = { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs }
  const sessionUser = { id: userId, role: userRole }

  if (action === 'SOUMETTRE') {
    if (!canSubmitAnalyse(sessionUser, ownership)) {
      return NextResponse.json({ error: 'Seul le propriétaire analyste peut soumettre l\'analyse' }, { status: 403 })
    }
    if (analyse.statut !== 'EN_COURS' && analyse.statut !== 'REJETE') {
      return NextResponse.json({ error: `Impossible de soumettre depuis le statut "${analyse.statut}"` }, { status: 400 })
    }

    const updated = await prisma.analyse.update({
      where: { id },
      data: { statut: 'SOUMIS', commentaireApprobation: null, approbateurId: null, approuveLe: null },
    })
    await auditLog('ANALYSE_SUBMITTED', { userId, userRole, targetId: id, targetType: 'analyse', ip: getClientIp(req), details: { nom: analyse.nom } })
    return NextResponse.json(updated)
  }

  if (action === 'APPROUVER') {
    if (!canApproveAnalyse(sessionUser, ownership)) {
      return NextResponse.json({ error: 'Seul un Risk Manager peut approuver l\'analyse' }, { status: 403 })
    }
    if (analyse.statut !== 'SOUMIS') {
      return NextResponse.json({ error: 'L\'analyse doit être soumise pour être approuvée' }, { status: 400 })
    }

    const updated = await prisma.analyse.update({
      where: { id },
      data: {
        statut: 'APPROUVE',
        approbateurId: userId,
        approuveLe: new Date(),
        commentaireApprobation: commentaire ?? null,
      },
    })
    await auditLog('ANALYSE_APPROVED', { userId, userRole, targetId: id, targetType: 'analyse', ip: getClientIp(req), details: { nom: analyse.nom, commentaire } })
    return NextResponse.json(updated)
  }

  if (action === 'REJETER') {
    if (!canApproveAnalyse(sessionUser, ownership)) {
      return NextResponse.json({ error: 'Seul un Risk Manager peut rejeter l\'analyse' }, { status: 403 })
    }
    if (analyse.statut !== 'SOUMIS') {
      return NextResponse.json({ error: 'L\'analyse doit être soumise pour être rejetée' }, { status: 400 })
    }
    if (!commentaire?.trim()) {
      return NextResponse.json({ error: 'Un commentaire est requis pour le rejet' }, { status: 400 })
    }

    const updated = await prisma.analyse.update({
      where: { id },
      data: {
        statut: 'REJETE',
        approbateurId: userId,
        approuveLe: new Date(),
        commentaireApprobation: commentaire,
      },
    })
    await auditLog('ANALYSE_REJECTED', { userId, userRole, targetId: id, targetType: 'analyse', ip: getClientIp(req), details: { nom: analyse.nom, commentaire } })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}
