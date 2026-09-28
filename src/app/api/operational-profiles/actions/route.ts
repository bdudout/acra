// ─── Promotion d'un écart de profil opérationnel en plan d'action unifié ──────
// POST { framework, ref } : crée un PlanAction lié au point (lien
// OPERATIONAL_PROFILE, targetId = profil, ref = point). Anti-doublon : si une
// action OUVERTE est déjà liée à ce point, elle est renvoyée (200, existing) au
// lieu d'en créer une seconde. Seul un écart ENREGISTRÉ et actionnable est promu.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerT } from '@/lib/i18n'
import { operationalProfileContext } from '@/lib/operational-profiles.server'
import { createOperationalProfilePlanAction, findOpenOperationalProfileAction } from '@/lib/plan-action.server'
import { OPERATIONAL_PROFILE_CATALOGS, isOperationalProfileFramework, isActionableGap, sanitizeOperationalProfileEntries } from '@/lib/operational-profiles'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const access = await operationalProfileContext()
  if (!access.ok) return NextResponse.json({ error: access.status === 401 ? 'Non autorisé' : 'Introuvable' }, { status: access.status })
  const { ctx } = access
  if (!ctx.canManage) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const rl = await rateLimit(`operational-profile-action:${ctx.userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })

  const body = await req.json().catch(() => ({})) as { framework?: unknown; ref?: unknown }
  if (!isOperationalProfileFramework(body.framework) || typeof body.ref !== 'string') return NextResponse.json({ error: 'Point de profil invalide' }, { status: 400 })
  const catalog = OPERATIONAL_PROFILE_CATALOGS[body.framework]
  const item = catalog.items.find(i => i.ref === body.ref)
  if (!item) return NextResponse.json({ error: 'Point de profil invalide' }, { status: 400 })

  const profile = await prisma.operationalProfile.findUnique({
    where: { organizationId_framework: { organizationId: ctx.orgId, framework: body.framework } },
    select: { id: true, entries: true },
  })
  const entry = profile && sanitizeOperationalProfileEntries(body.framework, profile.entries).find(e => e.ref === item.ref)
  if (!profile || !entry || !isActionableGap(entry)) return NextResponse.json({ error: 'Ce point ne présente pas un écart actionnable', code: 'NOT_A_GAP' }, { status: 400 })

  const existing = await findOpenOperationalProfileAction(prisma, ctx.orgId, profile.id, item.ref)
  if (existing) return NextResponse.json({ ...existing, existing: true }, { status: 200 })

  const t = await getServerT()
  const titre = t.operationalProfiles.actionTitle.replace('{ref}', item.ref).replace('{label}', item.label).slice(0, 200)
  const action = await createOperationalProfilePlanAction(prisma, {
    organizationId: ctx.orgId, profileId: profile.id, ref: item.ref,
    label: `${catalog.version} ${item.ref} — ${item.label}`.slice(0, 200),
    titre, description: entry.commentaire ?? null, porteur: entry.responsable ?? null, createdById: ctx.userId,
  })
  await auditLog('OPERATIONAL_PROFILE_UPDATED', {
    userId: ctx.userId, userRole: ctx.role, ip: getClientIp(req), organizationId: ctx.orgId,
    targetId: profile.id, targetType: 'operational-profile',
    details: { action: 'promote', framework: body.framework, ref: item.ref, planActionId: action.id },
  })
  return NextResponse.json({ ...action, existing: false }, { status: 201 })
}
