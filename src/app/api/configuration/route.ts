import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildDefaultConfig } from '@/lib/configuration-defaults'
import { canEditConfig, type UserRole } from '@/lib/permissions'

const GLOBAL_ID = 'global'

// GET /api/configuration — récupérer l'échelle commune de l'organisation
// (singleton global). Accessible à tout utilisateur authentifié ; renvoie les
// valeurs par défaut tant qu'aucune configuration n'a été enregistrée.
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const config = await prisma.configuration.findUnique({ where: { id: GLOBAL_ID } })
  if (!config) {
    return NextResponse.json({ ...buildDefaultConfig(4), isDefault: true })
  }
  return NextResponse.json(config)
}

// PUT /api/configuration — créer ou mettre à jour l'échelle commune (ADMIN uniquement)
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as any).id
  const userRole: UserRole = (session.user as any).role ?? 'ANALYSTE'
  if (!canEditConfig({ id: userId, role: userRole })) {
    return NextResponse.json({ error: 'Seul un administrateur peut modifier les échelles' }, { status: 403 })
  }

  const body = await req.json()
  const { nbNiveaux, echelleGravite, echelleVraisemblance, seuilsMatrice, matriceMode, matriceQualitative } = body

  if (!echelleGravite || !echelleVraisemblance) {
    return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
  }

  const mode = matriceMode === 'QUALITATIVE' ? 'QUALITATIVE' : 'QUANTITATIVE'
  const data = {
    nbNiveaux: nbNiveaux ?? 4,
    echelleGravite,
    echelleVraisemblance,
    seuilsMatrice,
    matriceMode: mode,
    matriceQualitative: mode === 'QUALITATIVE' ? (matriceQualitative ?? null) : null,
  }

  const config = await prisma.configuration.upsert({
    where: { id: GLOBAL_ID },
    create: { id: GLOBAL_ID, ...data },
    update: data,
  })

  return NextResponse.json(config)
}

// DELETE /api/configuration — remettre l'échelle commune aux valeurs par défaut (ADMIN uniquement)
export async function DELETE(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as any).id
  const userRole: UserRole = (session.user as any).role ?? 'ANALYSTE'
  if (!canEditConfig({ id: userId, role: userRole })) {
    return NextResponse.json({ error: 'Seul un administrateur peut réinitialiser les échelles' }, { status: 403 })
  }

  await prisma.configuration.deleteMany({ where: { id: GLOBAL_ID } })
  return NextResponse.json({ ok: true })
}
