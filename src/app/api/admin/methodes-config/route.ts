// ─── Méthodes d'analyse activées à l'instance — réglage SUPER_ADMIN ──────────
// GET  — méthodes actives + méthodes câblées (pour l'UI de bascule).
// PUT  — définit la liste des méthodes actives (assainie : câblées seulement,
//        EBIOS RM toujours présent). Cf. /admin/instance.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { cleanActiveMethodes, IMPLEMENTED_METHODS } from '@/lib/methodes'

export const dynamic = 'force-dynamic'

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }), session: null }
  if ((session.user as { role?: string }).role !== 'SUPER_ADMIN') {
    return { error: NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 }), session: null }
  }
  return { error: null, session }
}

// GET /api/admin/methodes-config
export async function GET() {
  const { error } = await requireSuperAdmin()
  if (error) return error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = await (prisma.configuration as any).findUnique({ where: { id: 'global' }, select: { methodesActives: true } })
  return NextResponse.json({ active: cleanActiveMethodes(cfg?.methodesActives), implemented: IMPLEMENTED_METHODS })
}

// PUT /api/admin/methodes-config — { methodes: string[] }
export async function PUT(req: NextRequest) {
  const { error, session } = await requireSuperAdmin()
  if (error) return error
  const body = await req.json().catch(() => ({}))
  if (!Array.isArray(body.methodes)) {
    return NextResponse.json({ error: 'methodes: tableau requis' }, { status: 400 })
  }
  const active = cleanActiveMethodes(body.methodes)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.configuration as any).update({ where: { id: 'global' }, data: { methodesActives: active } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: (session!.user as { id: string }).id, ip: getClientIp(req),
    targetType: 'configuration', details: { scope: 'methodes-config', active },
  })
  return NextResponse.json({ active })
}
