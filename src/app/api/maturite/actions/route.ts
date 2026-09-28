// ─── Écart de maturité → plan d'action unifié ─────────────────────────────────
// POST { referentiel, ref } : crée un PlanAction lié au point par un lien
// CONFORMITE (le MÊME que les actions de conformité : targetId = référentiel,
// ref = point). Anti-doublon : une action ouverte déjà liée au point (quelle que
// soit son origine, maturité ou conformité) est renvoyée (200, existing).
// Seul un écart ENREGISTRÉ (maturité actuelle < cible effective) est promu.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerLocale, getServerT } from '@/lib/i18n'
import { maturityContext, maturityReferentiels, loadMaturityProfile } from '@/lib/maturity.server'
import { createConformitePlanAction, findOpenConformiteAction } from '@/lib/plan-action.server'
import { isMaturityGap, effectiveTarget } from '@/lib/maturity'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const access = await maturityContext()
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Non autorisé' : 'Introuvable' }, { status: access.status })
  const { ctx } = access
  if (!ctx.canManage) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const rl = await rateLimit(`maturite-action:${ctx.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })

  const body = await req.json().catch(() => ({})) as { referentiel?: unknown; ref?: unknown }
  const locale = await getServerLocale()
  const referentiel = typeof body.referentiel === 'string' ? body.referentiel : ''
  const refs = await maturityReferentiels(ctx.orgId, locale)
  const meta = refs.find(r => r.code === referentiel)
  if (!meta || typeof body.ref !== 'string') return NextResponse.json({ error: 'Point invalide' }, { status: 400 })

  const profile = await loadMaturityProfile(ctx.orgId, referentiel, locale)
  const item = profile.items.find(i => i.ref === body.ref)
  const entry = item && profile.maturites[item.ref]
  if (!item || !isMaturityGap(entry, profile.maturiteCible)) return NextResponse.json({ error: 'Ce point ne présente pas un écart de maturité', code: 'NOT_A_GAP' }, { status: 400 })

  const existing = await findOpenConformiteAction(prisma, ctx.orgId, referentiel, item.ref)
  if (existing) return NextResponse.json({ ...existing, existing: true }, { status: 200 })

  const t = (await getServerT()).maturite
  const target = effectiveTarget(entry, profile.maturiteCible)
  const titre = t.actionTitle.replace('{ref}', item.ref).replace('{label}', item.nom)
    .replace('{from}', String(entry!.actuel)).replace('{to}', String(target)).slice(0, 200)
  const action = await createConformitePlanAction(prisma, {
    organizationId: ctx.orgId, referentiel, ref: item.ref,
    label: `${meta.nom} — ${item.ref} ${item.nom}`.slice(0, 200),
    titre, description: entry!.commentaire ?? null, porteur: entry!.responsable ?? null, createdById: ctx.userId,
  })
  await auditLog('MATURITY_UPDATED', {
    userId: ctx.userId, userRole: ctx.role, ip: getClientIp(req), organizationId: ctx.orgId,
    targetId: profile.conformiteId ?? undefined, targetType: 'conformite',
    details: { action: 'promote', referentiel, ref: item.ref, planActionId: action.id },
  })
  return NextResponse.json({ ...action, existing: false }, { status: 201 })
}
