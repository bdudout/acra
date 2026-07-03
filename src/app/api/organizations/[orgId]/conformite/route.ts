import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import {
  sanitizeConformite, applyConformiteStatut, conformiteStats,
  CONFORMITE_STATUTS, type ConformiteStatut,
} from '@/lib/conformite'
import { getOrgConfig } from '@/lib/org-config.server'
import { shouldSnapshotOnChange, isOrgLevelConformite } from '@/lib/conformite-config'
import { getFrameworkControles, FRAMEWORK_META, type FrameworkId } from '@/lib/frameworks-data'
import { getServerLocale } from '@/lib/i18n'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'

/** Rôles de gouvernance autorisés à gérer la conformité au niveau organisation. */
function canManageOrgConformite(role: UserRole): boolean {
  return isAdminRole(role) || role === 'RSSI' || role === 'RISK_MANAGER'
}

/** Contrôle commun : session, rôle, périmètre org, feature active, référentiel connu. */
async function guard(req: NextRequest, orgId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as any).id
  const userRole: UserRole = (session.user as any).role ?? 'ANALYSTE'

  const rl = rateLimit(`org-conformite:${userId}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return { error: NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) }) }

  if (!canManageOrgConformite(userRole)) return { error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }

  // Périmètre : l'organisation doit être visible par l'utilisateur.
  const scope = await getAnalyseScope(userId, userRole)
  const visibles = scope.scope.visibleOrgIds ?? []
  const allowed = orgId === 'global' || visibles.length === 0 || visibles.includes(orgId)
  if (!allowed) return { error: NextResponse.json({ error: 'Organisation hors périmètre' }, { status: 403 }) }

  const orgConfig = await getOrgConfig(orgId)
  if (!orgConfig.conformiteActive) return { error: NextResponse.json({ error: 'Conformité désactivée' }, { status: 403 }) }
  if (!isOrgLevelConformite(orgConfig.conformiteNiveau)) return { error: NextResponse.json({ error: 'Conformité non portée au niveau organisation' }, { status: 409 }) }

  const body = await req.json().catch(() => null)
  const referentiel = String(body?.referentiel ?? '').trim()
  if (!referentiel || !(referentiel in FRAMEWORK_META) || referentiel === 'CUSTOM') {
    return { error: NextResponse.json({ error: 'Référentiel invalide' }, { status: 400 }) }
  }
  return { userId, userRole, orgConfig, body, referentiel }
}

/** Récupère (et crée si besoin) l'entité Conformite (organisation × référentiel). */
async function getOrCreate(orgId: string, referentiel: string) {
  return prisma.conformite.upsert({
    where: { organizationId_referentiel: { organizationId: orgId, referentiel } },
    create: { organizationId: orgId, referentiel, entries: [] },
    update: {},
    select: { id: true, entries: true },
  })
}

/**
 * PATCH /api/organizations/[orgId]/conformite — met à jour le statut d'un contrôle
 * de la conformité de référence de l'organisation. Body { referentiel, ref, statut }.
 * Crée un snapshot si le mode est CHANGEMENT. Renvoie les stats à jour.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const g = await guard(req, orgId)
  if ('error' in g) return g.error
  const { body, referentiel, orgConfig, userId } = g

  const ref = String(body?.ref ?? '').trim()
  const statut = body?.statut as ConformiteStatut
  if (!ref || !(CONFORMITE_STATUTS as string[]).includes(statut)) {
    return NextResponse.json({ error: 'Requête invalide (ref/statut)' }, { status: 400 })
  }
  const locale = await getServerLocale()
  const controles = getFrameworkControles(referentiel as FrameworkId, undefined, locale)
  if (!new Set(controles.map(c => c.ref)).has(ref)) {
    return NextResponse.json({ error: 'Contrôle inconnu du référentiel' }, { status: 400 })
  }

  const conf = await getOrCreate(orgId, referentiel)
  const updated = applyConformiteStatut(sanitizeConformite(conf.entries), ref, statut)
  await prisma.conformite.update({ where: { id: conf.id }, data: { entries: updated as unknown as object } })
  if (shouldSnapshotOnChange(orgConfig.conformiteSnapshotMode)) {
    await prisma.conformiteSnapshot.create({ data: { conformiteId: conf.id, entries: updated as unknown as object, createdById: userId } })
  }
  return NextResponse.json({ ok: true, stats: conformiteStats(updated, controles.length) })
}

/**
 * POST /api/organizations/[orgId]/conformite — fige une version (snapshot) de la
 * conformité de référence courante. Body { referentiel, label? }. Mode MANUEL.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const g = await guard(req, orgId)
  if ('error' in g) return g.error
  const { body, referentiel, userId } = g

  const conf = await getOrCreate(orgId, referentiel)
  const label = typeof body?.label === 'string' ? body.label.trim().slice(0, 120) || null : null
  const snap = await prisma.conformiteSnapshot.create({
    data: { conformiteId: conf.id, entries: sanitizeConformite(conf.entries) as unknown as object, label, createdById: userId },
    select: { id: true, createdAt: true, label: true },
  })
  return NextResponse.json({ ok: true, snapshot: snap })
}
