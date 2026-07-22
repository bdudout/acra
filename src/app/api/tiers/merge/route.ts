import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  analyseWhereClause,
  canEditAnalyse,
  type UserRole,
  type SessionUser,
} from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { validateMergeRequest, planTierRename } from '@/lib/tiers'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Seules les analyses non finalisées sont modifiables par la fusion : on ne
// touche jamais une analyse soumise/approuvée/terminée/archivée, même si
// l'utilisateur en est propriétaire.
const STATUTS_EDITABLES = new Set(['EN_COURS', 'REJETE'])

/**
 * POST /api/tiers/merge — fusionne des tiers en doublon (issue #46, étape 2b) :
 * renomme vers `cible` toutes les parties prenantes portant l'un des `noms`,
 * UNIQUEMENT dans les analyses que l'utilisateur peut éditer ET non finalisées.
 * Les PP situées dans des analyses verrouillées ou hors périmètre d'édition sont
 * laissées intactes et comptées dans `blocked`. Écriture auditée.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const userId = (session.user as { id: string }).id
  const userRole: UserRole = (session.user as { role?: UserRole }).role ?? 'ANALYSTE'
  const user: SessionUser = { id: userId, role: userRole }

  // Rate limiting (#118) : borne la fréquence des fusions comme les autres écritures.
  const rl = rateLimit(`tiers-merge:${userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Trop de requêtes. Réessayez dans un instant.' },
      { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) }
    )
  }

  let body: { noms?: unknown; cible?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const noms = Array.isArray(body.noms) ? body.noms.filter((n): n is string => typeof n === 'string') : []
  const cible = typeof body.cible === 'string' ? body.cible : ''

  const erreur = validateMergeRequest(noms, cible)
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 })

  const target = cible.trim()
  const { role, scope } = await getAnalyseScope(userId, userRole)

  // Candidats : PP au nom ciblé, dans le périmètre VISIBLE (lecture). Le filtrage
  // d'ÉDITION est appliqué ensuite, par analyse (le scope lecture est plus large).
  const rows = await prisma.partiePrenante.findMany({
    where: {
      nom: { in: noms },
      analyse: analyseWhereClause(userId, role, scope),
    },
    select: {
      id: true,
      nom: true,
      analyse: {
        select: {
          statut: true,
          userId: true,
          accesUtilisateurs: { select: { userId: true, permission: true } },
        },
      },
    },
  })

  const { renameIds, blocked } = planTierRename(
    rows,
    target,
    (r) =>
      STATUTS_EDITABLES.has(r.analyse.statut) &&
      canEditAnalyse(user, {
        userId: r.analyse.userId,
        accesUtilisateurs: r.analyse.accesUtilisateurs,
      }),
  )

  if (renameIds.length > 0) {
    await prisma.partiePrenante.updateMany({
      where: { id: { in: renameIds } },
      data: { nom: target },
    })
  }

  await auditLog('TIERS_MERGED', {
    userId,
    userRole,
    targetType: 'tiers',
    ip: getClientIp(request),
    details: { noms, cible: target, renamed: renameIds.length, blocked },
  })

  return NextResponse.json({ renamed: renameIds.length, blocked, cible: target })
}
