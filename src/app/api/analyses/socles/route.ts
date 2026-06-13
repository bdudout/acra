import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/analyses/socles
 *
 * Returns all analyses marked as socle (isSocle = true) that the current user
 * has access to (owns or has been granted any permission on).
 *
 * Used to populate the "inherit from socle" dropdown on the new analysis form.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId = (session.user as any).id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const socles = await (prisma.analyse as any).findMany({
    where: {
      isSocle: true,
      OR: [
        { userId },
        { accesUtilisateurs: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      nom: true,
      organisation: true,
      secteur: true,
      statut: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json({ socles })
}
