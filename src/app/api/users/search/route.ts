import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitHeaders, LIMIT_SEARCH } from '@/lib/rate-limit'

// GET /api/users/search?q=… — autocomplétion d'invitation de collaborateurs.
// Accessible à tout utilisateur authentifié ; renvoie au plus 8 comptes ACTIFS
// dont l'e-mail ou le nom contient la requête (≥ 2 caractères). Champs minimaux.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const userId = (session.user as any).id

  const rl = rateLimit(`user-search:${userId}`, LIMIT_SEARCH.limit, LIMIT_SEARCH.windowMs)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Trop de requêtes. Réessayez dans une minute.' },
      { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) }
    )
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ users: [] })

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { not: userId }, // ne pas se proposer soi-même
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true },
    orderBy: { email: 'asc' },
    take: 8,
  })

  return NextResponse.json({ users })
}
