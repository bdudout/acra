// ─── Profils opérationnels US/UK (NIST CSF 2.0 / NCSC CAF v4.0) ───────────────
// GET : profils de l'organisation active (état vierge si jamais évalué), stats et
//       actions liées. Lecture : tout membre de l'org (AUDITEUR/LECTEUR inclus).
// PUT : évaluation d'un profil (points modifiés + niveau cible). Réservé aux rôles
//       d'évaluation (peutEvaluerProfilOperationnel). Horodatage par point côté
//       serveur, diff journalisé (historique), rate limit d'écriture.
// Module inactif (config EFFECTIVE, politique d'instance incluse) → 404.

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { operationalProfileContext, loadOperationalProfiles } from '@/lib/operational-profiles.server'
import {
  OPERATIONAL_PROFILE_CATALOGS, isOperationalProfileFramework, isOperationalProfileTarget,
  sanitizeOperationalProfileEntries, applyOperationalProfileUpdate,
} from '@/lib/operational-profiles'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

const NOT_FOUND = { 401: 'Non autorisé', 404: 'Introuvable' } as const

export async function GET() {
  const access = await operationalProfileContext()
  if (!access.ok) return NextResponse.json({ error: NOT_FOUND[access.status] }, { status: access.status })
  const profiles = await loadOperationalProfiles(access.ctx.orgId)
  return NextResponse.json({
    profiles: profiles.map(p => ({ ...p, catalog: OPERATIONAL_PROFILE_CATALOGS[p.framework] })),
    canManage: access.ctx.canManage,
  })
}

export async function PUT(req: NextRequest) {
  const access = await operationalProfileContext()
  if (!access.ok) return NextResponse.json({ error: NOT_FOUND[access.status] }, { status: access.status })
  const { ctx } = access
  if (!ctx.canManage) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const rl = await rateLimit(`operational-profile:${ctx.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })

  const body = await req.json().catch(() => ({})) as { framework?: unknown; entries?: unknown; cible?: unknown }
  if (!isOperationalProfileFramework(body.framework)) return NextResponse.json({ error: 'Référentiel de profil invalide' }, { status: 400 })
  const framework = body.framework
  // cible : absente = inchangée ; null/'' = effacée ; sinon niveau valide du cadre.
  let cible: string | null | undefined
  if (body.cible === null || body.cible === '') cible = null
  else if (body.cible !== undefined) {
    if (!isOperationalProfileTarget(framework, body.cible)) return NextResponse.json({ error: 'Niveau cible invalide' }, { status: 400 })
    cible = body.cible
  }

  const existing = await prisma.operationalProfile.findUnique({
    where: { organizationId_framework: { organizationId: ctx.orgId, framework } },
    select: { entries: true, cible: true },
  })
  const previous = sanitizeOperationalProfileEntries(framework, existing?.entries)
  const incoming = sanitizeOperationalProfileEntries(framework, body.entries)
  const { entries, changes } = applyOperationalProfileUpdate(previous, incoming, { userId: ctx.userId, now: new Date() })
  const cibleChanged = cible !== undefined && cible !== (existing?.cible ?? null)
  if (!changes.length && !cibleChanged && existing) {
    return NextResponse.json({ framework, entries, cible: existing.cible, unchanged: true })
  }

  const saved = await prisma.operationalProfile.upsert({
    where: { organizationId_framework: { organizationId: ctx.orgId, framework } },
    create: { organizationId: ctx.orgId, framework, cible: cible ?? null, entries: entries as unknown as Prisma.InputJsonValue, updatedById: ctx.userId },
    update: { entries: entries as unknown as Prisma.InputJsonValue, updatedById: ctx.userId, ...(cible !== undefined ? { cible } : {}) },
    select: { id: true, cible: true, updatedAt: true },
  })
  await auditLog('OPERATIONAL_PROFILE_UPDATED', {
    userId: ctx.userId, userRole: ctx.role, ip: getClientIp(req), organizationId: ctx.orgId,
    targetId: saved.id, targetType: 'operational-profile',
    details: {
      framework,
      ...(cibleChanged ? { cible: [existing?.cible ?? null, cible] } : {}),
      changes: changes.slice(0, 50), changesCount: changes.length,
    },
  })
  return NextResponse.json({ framework, entries, cible: saved.cible, updatedAt: saved.updatedAt })
}
