import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { daysUntilPurge } from '@/lib/demo'
import { isDemoInstance, getDemoConfig } from '@/lib/demo-server'

/**
 * GET /api/demo/status — état démo de l'utilisateur courant (bandeau ACRA-Demo).
 * Renvoie le nombre de jours avant purge de SON organisation démo (compte à rebours).
 * `{ demo:false }` hors mode démo ou sans session. Aucune donnée sensible.
 */
export async function GET() {
  if (!(await isDemoInstance())) return NextResponse.json({ demo: false })

  // Contenu public configurable (surcharges brutes ; le client applique le repli
  // i18n via resolvePublicContent). Lisible même par un visiteur anonyme.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = await (prisma as any).configuration.findUnique({
    where: { id: 'global' },
    select: { publicNotice: true, publicContactUrl: true, publicContactLabel: true },
  }).catch(() => null)
  const content = {
    publicNotice: cfg?.publicNotice ?? null,
    publicContactUrl: cfg?.publicContactUrl ?? null,
    publicContactLabel: cfg?.publicContactLabel ?? null,
  }

  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return NextResponse.json({ demo: true, daysUntilPurge: null, content })

  const membership = await prisma.orgMembership.findFirst({
    where: { userId, organizationId: { not: 'global' } },
    select: { organization: { select: { createdAt: true, lastActivityAt: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const org = membership?.organization
  const days = org ? daysUntilPurge(org, await getDemoConfig()) : null
  return NextResponse.json({ demo: true, daysUntilPurge: days, content })
}
