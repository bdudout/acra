import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDemoMode, DEMO_DEFAULTS, daysUntilPurge } from '@/lib/demo'

/**
 * GET /api/demo/status — état démo de l'utilisateur courant (bandeau ACRA-Demo).
 * Renvoie le nombre de jours avant purge de SON organisation démo (compte à rebours).
 * `{ demo:false }` hors mode démo ou sans session. Aucune donnée sensible.
 */
export async function GET() {
  if (!isDemoMode()) return NextResponse.json({ demo: false })
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return NextResponse.json({ demo: true, daysUntilPurge: null })

  const membership = await prisma.orgMembership.findFirst({
    where: { userId, organizationId: { not: 'global' } },
    select: { organization: { select: { createdAt: true, lastActivityAt: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const org = membership?.organization
  const days = org ? daysUntilPurge(org, DEMO_DEFAULTS) : null
  return NextResponse.json({ demo: true, daysUntilPurge: days })
}
