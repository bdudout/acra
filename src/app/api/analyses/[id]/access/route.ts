import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { canManageAccess } from '@/lib/permissions'
import type { AnalysePermission } from '@/lib/permissions'

type Params = { params: Promise<{ id: string }> }

// GET /api/analyses/[id]/access — liste des accès de l'analyse
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  const analyse = await prisma.analyse.findUnique({
    where: { id },
    include: { accesUtilisateurs: { include: { user: { select: { id: true, name: true, email: true, role: true } } } } },
  })
  if (!analyse || analyse.deletedAt) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  if (!canManageAccess({ id: userId, role: userRole }, { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs })) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  return NextResponse.json(analyse.accesUtilisateurs)
}

// POST /api/analyses/[id]/access — inviter un utilisateur
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  const analyse = await prisma.analyse.findUnique({
    where: { id },
    include: { accesUtilisateurs: true },
  })
  if (!analyse || analyse.deletedAt) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  if (!canManageAccess({ id: userId, role: userRole }, { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs })) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { email, permission } = await req.json() as { email: string; permission: AnalysePermission }

  if (!email || !permission) {
    return NextResponse.json({ error: 'email et permission requis' }, { status: 400 })
  }

  // Retrouver l'utilisateur par email
  const targetUser = await prisma.user.findUnique({ where: { email } })
  if (!targetUser) {
    return NextResponse.json({ error: `Aucun compte trouvé pour ${email}` }, { status: 404 })
  }

  if (targetUser.id === analyse.userId) {
    return NextResponse.json({ error: 'Le propriétaire a déjà tous les droits' }, { status: 400 })
  }

  // Upsert de l'accès
  const acces = await prisma.analyseAcces.upsert({
    where: { analyseId_userId: { analyseId: id, userId: targetUser.id } },
    update: { permission },
    create: { analyseId: id, userId: targetUser.id, permission, invitePar: userId },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  })

  return NextResponse.json(acces, { status: 201 })
}

// DELETE /api/analyses/[id]/access?targetUserId=xxx — retirer un accès
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const userId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  const analyse = await prisma.analyse.findUnique({
    where: { id },
    include: { accesUtilisateurs: true },
  })
  if (!analyse || analyse.deletedAt) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  if (!canManageAccess({ id: userId, role: userRole }, { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs })) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const targetUserId = searchParams.get('targetUserId')
  if (!targetUserId) return NextResponse.json({ error: 'targetUserId manquant' }, { status: 400 })

  await prisma.analyseAcces.deleteMany({
    where: { analyseId: id, userId: targetUserId },
  })

  return NextResponse.json({ ok: true })
}
