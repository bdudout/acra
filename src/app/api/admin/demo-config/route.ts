/**
 * GET  /api/admin/demo-config  — Réglages démo effectifs + tableau de bord (orgs
 *                                actives, prochaines purges).
 * PUT  /api/admin/demo-config  — Enregistrer les réglages (surcharges DemoConfig).
 * POST /api/admin/demo-config  — { action: 'purge' } : purge manuelle immédiate.
 *
 * Réservé au SUPER_ADMIN, sur une instance de démo prouvée (`isDemoInstance()`).
 * Les réglages surchargent DEMO_DEFAULTS et sont persistés dans Configuration.demoConfig.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { auditLog, getClientIp } from '@/lib/logger'
import { resolveDemoConfig, orgExpiresAt, daysUntilPurge, type DemoConfig } from '@/lib/demo'
import { isDemoInstance, getDemoConfig, purgeExpiredDemoOrgs } from '@/lib/demo-server'

const ConfigSchema = z.object({
  inactivityDays:    z.coerce.number().int().min(1).max(3650),
  hardCapDays:       z.coerce.number().int().min(1).max(3650),
  warningDays:       z.coerce.number().int().min(0).max(365),
  maxAnalysesPerOrg: z.coerce.number().int().min(1).max(100000),
  maxActiveOrgs:     z.coerce.number().int().min(1).max(1000000),
})

async function requireSuperAdminDemo() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }), session: null }
  if ((session.user as { role?: string }).role !== 'SUPER_ADMIN') {
    return { error: NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 }), session: null }
  }
  if (!(await isDemoInstance())) {
    return { error: NextResponse.json({ error: 'Instance non démo' }, { status: 403 }), session: null }
  }
  return { error: null, session }
}

/** Tableau de bord : orgs actives + prochaines purges (les plus proches d'abord). */
async function dashboard(cfg: DemoConfig) {
  const orgs = await prisma.organization.findMany({
    where: { actif: true, id: { not: 'global' } },
    select: { id: true, nom: true, createdAt: true, lastActivityAt: true },
  })
  const now = new Date()
  const upcoming = orgs
    .map(o => ({
      id: o.id,
      nom: o.nom,
      createdAt: o.createdAt,
      lastActivityAt: o.lastActivityAt,
      expiresAt: orgExpiresAt(o, cfg),
      daysUntilPurge: daysUntilPurge(o, cfg, now),
    }))
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
  return { activeOrgs: orgs.length, upcoming: upcoming.slice(0, 50) }
}

export async function GET() {
  const { error } = await requireSuperAdminDemo()
  if (error) return error
  const cfg = await getDemoConfig()
  const config = await prisma.configuration.findUnique({ where: { id: 'global' }, select: { demoConfig: true } })
  return NextResponse.json({
    config: cfg,
    overridesSet: config?.demoConfig != null,
    ...(await dashboard(cfg)),
  })
}

export async function PUT(req: NextRequest) {
  const { error, session } = await requireSuperAdminDemo()
  if (error) return error

  const parsed = ConfigSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  }
  // On persiste la config résolue (normalisée) pour éviter les valeurs partielles.
  const resolved = resolveDemoConfig(parsed.data)
  await prisma.configuration.update({
    where: { id: 'global' },
    data: { demoConfig: resolved as unknown as object },
  })
  await auditLog('DEMO_CONFIG_UPDATED', {
    userId: (session!.user as { id: string }).id, ip: getClientIp(req),
    targetType: 'configuration', details: { ...resolved },
  })
  return NextResponse.json({ ok: true, config: resolved, ...(await dashboard(resolved)) })
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireSuperAdminDemo()
  if (error) return error
  const body = await req.json().catch(() => ({}))
  if (body?.action !== 'purge') {
    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  }
  const { purged, orgIds } = await purgeExpiredDemoOrgs()
  await auditLog('DEMO_ORG_PURGED', {
    userId: (session!.user as { id: string }).id, ip: getClientIp(req),
    targetType: 'organization', details: { purged, orgIds, manual: true },
  })
  const cfg = await getDemoConfig()
  return NextResponse.json({ ok: true, purged, ...(await dashboard(cfg)) })
}
