import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { OPERATIONAL_PROFILE_CATALOGS, sanitizeOperationalProfileEntries, type OperationalProfileFramework } from '@/lib/operational-profiles'
import { auditLog, getClientIp } from '@/lib/logger'

const PREFIX = 'OP_PROFILE:'
const isFramework = (value: unknown): value is OperationalProfileFramework => value === 'NIST_CSF_2_0' || value === 'NCSC_CAF_V4'
const canManage = (role: UserRole | null) => !!role && (isAdminRole(role) || role === 'RSSI' || role === 'RISK_MANAGER' || role === 'CONFORMITE')

async function context() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const userId = (session.user as { id: string }).id
  const instanceRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  if (!scope.activeOrgId) return { error: NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 }) }
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.profilsOperationnelsActive) return { error: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  return { userId, role: scope.role, orgId: scope.activeOrgId }
}

/** Profils de l'organisation active ; l'absence d'évaluation est renvoyée explicitement. */
export async function GET() {
  const ctx = await context()
  if (!ctx || 'error' in ctx) return ctx?.error ?? NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const rows = await prisma.conformite.findMany({
    where: { organizationId: ctx.orgId, referentiel: { in: Object.keys(OPERATIONAL_PROFILE_CATALOGS).map(key => `${PREFIX}${key}`) }, entite: '' },
    select: { referentiel: true, entries: true, updatedAt: true },
  })
  const saved = new Map(rows.map(row => [row.referentiel.slice(PREFIX.length) as OperationalProfileFramework, row]))
  return NextResponse.json({
    profiles: (Object.keys(OPERATIONAL_PROFILE_CATALOGS) as OperationalProfileFramework[]).map(framework => ({
      framework,
      catalog: OPERATIONAL_PROFILE_CATALOGS[framework],
      entries: sanitizeOperationalProfileEntries(framework, saved.get(framework)?.entries),
      updatedAt: saved.get(framework)?.updatedAt ?? null,
    })),
    canManage: canManage(ctx.role),
  })
}

/** Enregistre une évaluation entière de profil après nettoyage des références/états. */
export async function PUT(req: NextRequest) {
  const ctx = await context()
  if (!ctx || 'error' in ctx) return ctx?.error ?? NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!canManage(ctx.role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as { framework?: unknown; entries?: unknown }
  if (!isFramework(body.framework)) return NextResponse.json({ error: 'Référentiel de profil invalide' }, { status: 400 })
  const entries = sanitizeOperationalProfileEntries(body.framework, body.entries)
  const profile = await prisma.conformite.upsert({
    where: { organizationId_referentiel_entite: { organizationId: ctx.orgId, referentiel: `${PREFIX}${body.framework}`, entite: '' } },
    create: { organizationId: ctx.orgId, referentiel: `${PREFIX}${body.framework}`, entite: '', nom: OPERATIONAL_PROFILE_CATALOGS[body.framework].title, entries: entries as unknown as Prisma.InputJsonValue },
    update: { entries: entries as unknown as Prisma.InputJsonValue, nom: OPERATIONAL_PROFILE_CATALOGS[body.framework].title },
    select: { updatedAt: true },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: ctx.userId, userRole: ctx.role ?? 'LECTEUR', ip: getClientIp(req), details: { scope: 'operational-profile', framework: body.framework, count: entries.length } })
  return NextResponse.json({ framework: body.framework, entries, updatedAt: profile.updatedAt })
}
