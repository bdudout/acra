// ─── Maturité (profils cibles CMMI) d'un référentiel ──────────────────────────
// GET ?referentiel= : profil (points, maturité actuelle/cible, statut de conformité
//     du même point, synthèse par domaine, actions liées). Lecture : tout membre.
// PUT { referentiel, maturites?, maturiteCible? } : évaluation, réservée aux rôles
//     d'évaluation. Écrit UNIQUEMENT la couche `maturites`/`maturiteCible` du suivi
//     Conformite org-wide (jamais `entries`, la conformité). Horodatage par point
//     côté serveur, diff journalisé, rate limit. Module inactif → 404.

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { lockConformite } from '@/lib/row-lock.server'
import { getServerLocale, getServerT } from '@/lib/i18n'
import { maturityContext, maturityReferentiels, loadMaturityProfile, orgMaturityScale } from '@/lib/maturity.server'
import { sanitizeMaturites, applyMaturityUpdate, isMaturityLevel } from '@/lib/maturity'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

const fail = (status: 401 | 404) => NextResponse.json({ error: status === 401 ? 'Non autorisé' : 'Introuvable' }, { status })

export async function GET(req: NextRequest) {
  const access = await maturityContext()
  if (!access.ok) return fail(access.status)
  const { ctx } = access
  const locale = await getServerLocale()
  const referentiels = await maturityReferentiels(ctx.orgId, locale)
  const code = req.nextUrl.searchParams.get('referentiel') ?? referentiels[0]?.code
  if (!code || !referentiels.some(r => r.code === code)) return NextResponse.json({ error: 'Référentiel invalide' }, { status: 400 })
  const [profile, scale] = await Promise.all([loadMaturityProfile(ctx.orgId, code, locale), orgMaturityScale(ctx.orgId, await getServerT())])
  return NextResponse.json({ profile, scale, referentiels, canManage: ctx.canManage })
}

export async function PUT(req: NextRequest) {
  const access = await maturityContext()
  if (!access.ok) return fail(access.status)
  const { ctx } = access
  if (!ctx.canManage) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const rl = await rateLimit(`maturite:${ctx.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })

  const body = await req.json().catch(() => ({})) as { referentiel?: unknown; maturites?: unknown; maturiteCible?: unknown }
  const locale = await getServerLocale()
  const referentiel = typeof body.referentiel === 'string' ? body.referentiel : ''
  const referentiels = await maturityReferentiels(ctx.orgId, locale)
  if (!referentiels.some(r => r.code === referentiel)) return NextResponse.json({ error: 'Référentiel invalide' }, { status: 400 })
  // maturiteCible : absente = inchangée ; null = effacée ; sinon niveau 0–5.
  let cible: number | null | undefined
  if (body.maturiteCible === null) cible = null
  else if (body.maturiteCible !== undefined) {
    if (!isMaturityLevel(body.maturiteCible)) return NextResponse.json({ error: 'Niveau cible invalide' }, { status: 400 })
    cible = body.maturiteCible
  }

  const current = await loadMaturityProfile(ctx.orgId, referentiel, locale)
  const refs = new Set(current.items.map(i => i.ref))
  // Seules les références du référentiel sont retenues ; un point vidé ({}) est retiré.
  const incoming = body.maturites && typeof body.maturites === 'object' && !Array.isArray(body.maturites)
    ? Object.fromEntries(Object.entries(body.maturites as Record<string, unknown>).filter(([ref]) => refs.has(ref)).slice(0, 1000))
    : {}
  // Fusion sous verrou de ligne (audit 2026-09-30, D2) : la maturité est relue DANS la
  // transaction, sinon deux évaluateurs de points différents s'écrasent.
  const key = { organizationId_referentiel_entite: { organizationId: ctx.orgId, referentiel, entite: '' } }
  const outcome = await prisma.$transaction(async tx => {
    const row = await tx.conformite.upsert({ where: key, create: { organizationId: ctx.orgId, referentiel, entite: '', entries: [] }, update: {}, select: { id: true, maturites: true, maturiteCible: true } })
    await lockConformite(tx, row.id)
    const fresh = await tx.conformite.findUniqueOrThrow({ where: { id: row.id }, select: { maturites: true, maturiteCible: true } })
    const before = sanitizeMaturites(fresh.maturites, refs)
    const beforeCible = isMaturityLevel(fresh.maturiteCible) ? fresh.maturiteCible : null
    const { maturites, changes } = applyMaturityUpdate(before, incoming, { userId: ctx.userId, now: new Date() })
    const cibleChanged = cible !== undefined && cible !== beforeCible
    if (!changes.length && !cibleChanged) return { unchanged: true as const, maturites: before, maturiteCible: beforeCible }
    const data = { maturites: sanitizeMaturites(maturites, refs) as unknown as Prisma.InputJsonValue, ...(cible !== undefined ? { maturiteCible: cible } : {}) }
    const saved = await tx.conformite.update({ where: { id: row.id }, data, select: { id: true, maturites: true, maturiteCible: true, updatedAt: true } })
    return { unchanged: false as const, saved, changes, cibleChanged, beforeCible }
  })
  if (outcome.unchanged) return NextResponse.json({ maturites: outcome.maturites, maturiteCible: outcome.maturiteCible, unchanged: true })
  const { saved, changes, cibleChanged } = outcome
  await auditLog('MATURITY_UPDATED', {
    userId: ctx.userId, userRole: ctx.role, ip: getClientIp(req), organizationId: ctx.orgId,
    targetId: saved.id, targetType: 'conformite',
    details: {
      referentiel,
      ...(cibleChanged ? { maturiteCible: [outcome.beforeCible, cible] } : {}),
      changes: changes.slice(0, 50), changesCount: changes.length,
    },
  })
  return NextResponse.json({ maturites: saved.maturites, maturiteCible: saved.maturiteCible, updatedAt: saved.updatedAt })
}
