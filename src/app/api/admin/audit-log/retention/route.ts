import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withAccess } from '@/lib/with-access.server'
import { canAdminInstance } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { lireRetention, RETENTION_MAX_MOIS, RETENTION_MIN_MOIS } from '@/lib/audit-retention'

export const dynamic = 'force-dynamic'
const superAdmin = { org: 'none', allow: (role: Parameters<typeof canAdminInstance>[0]['role']) => canAdminInstance({ id: '', role }) } as const

/** GET — rétention du journal d'audit (mois, null = illimitée) et dernières purges archivées (super-administrateur). */
export const GET = withAccess(superAdmin, async () => {
  const [cfg, purges] = await Promise.all([
    prisma.siemConfig.findUnique({ where: { id: 'global' }, select: { auditRetentionMois: true } }),
    prisma.auditPurge.findMany({ orderBy: { jusquaSeq: 'desc' }, take: 10 }),
  ])
  return NextResponse.json({
    retentionMois: cfg?.auditRetentionMois ?? null, min: RETENTION_MIN_MOIS, max: RETENTION_MAX_MOIS,
    purges: purges.map(p => ({ id: p.id, nb: p.nb, jusquaSeq: p.jusquaSeq.toString(), avant: p.avant, archiveCle: p.archiveCle, archiveSha256: p.archiveSha256, createdAt: p.createdAt })),
  })
})

/** PUT { retentionMois: number | null } — règle la rétention (bornes contrôlées), journalisé. */
export const PUT = withAccess({ ...superAdmin, body: z.object({ retentionMois: z.unknown() }) }, async (req, { user, body }) => {
  const r = lireRetention(body.retentionMois)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  await prisma.siemConfig.upsert({ where: { id: 'global' }, create: { id: 'global', auditRetentionMois: r.value }, update: { auditRetentionMois: r.value } })
  await auditLog('AUDIT_RETENTION_MODIFIEE', { userId: user.id, userRole: user.role, ip: getClientIp(req), details: { retentionMois: r.value } })
  return NextResponse.json({ retentionMois: r.value })
})
