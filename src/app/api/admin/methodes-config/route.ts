// ─── Méthodes d'analyse activées à l'instance — réglage SUPER_ADMIN ──────────
// GET  — méthodes actives + méthodes câblées (pour l'UI de bascule).
// PUT  — définit la liste des méthodes actives (assainie : câblées seulement,
//        EBIOS RM toujours présent). Cf. /admin/instance.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { cleanActiveMethodes, IMPLEMENTED_METHODS, MODULE_METHODS } from '@/lib/methodes'
import { requireInstanceAdmin } from '@/lib/route-guard.server'

export const dynamic = 'force-dynamic'


// GET /api/admin/methodes-config
export async function GET() {
  const { error } = await requireInstanceAdmin()
  if (error) return error
  const cfg = await prisma.configuration.findUnique({ where: { id: 'global' }, select: { methodesActives: true } })
  return NextResponse.json({ active: cleanActiveMethodes(cfg?.methodesActives), implemented: IMPLEMENTED_METHODS.filter(m => !MODULE_METHODS.includes(m)) })
}

// PUT /api/admin/methodes-config — { methodes: string[] }
export async function PUT(req: NextRequest) {
  const { error, session } = await requireInstanceAdmin()
  if (error) return error
  const body = await req.json().catch(() => ({}))
  if (!Array.isArray(body.methodes)) {
    return NextResponse.json({ error: 'methodes: tableau requis' }, { status: 400 })
  }
  const active = cleanActiveMethodes(body.methodes)

  await prisma.configuration.update({ where: { id: 'global' }, data: { methodesActives: active } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: (session!.user as { id: string }).id, ip: getClientIp(req),
    targetType: 'configuration', details: { scope: 'methodes-config', active },
  })
  return NextResponse.json({ active })
}
