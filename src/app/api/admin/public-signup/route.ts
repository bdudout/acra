import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Réglage d'INSTANCE (indépendant du mode démo) → réservé au SUPER_ADMIN, sur
// toute instance (contrairement à /admin/demo-config qui exige une instance démo).
async function requireSuperAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }), session: null }
  if ((session.user as { role?: string }).role !== 'SUPER_ADMIN') {
    return { error: NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 }), session: null }
  }
  return { error: null, session }
}

// GET /api/admin/public-signup — état du toggle d'inscription publique.
export async function GET() {
  const { error } = await requireSuperAdmin()
  if (error) return error
  const config = await prisma.configuration.findUnique({ where: { id: 'global' }, select: { publicSignupActive: true } })
  return NextResponse.json({ publicSignupActive: config?.publicSignupActive === true })
}

// PUT /api/admin/public-signup — activer/désactiver l'inscription publique.
export async function PUT(req: NextRequest) {
  const { error, session } = await requireSuperAdmin()
  if (error) return error
  const body = await req.json().catch(() => ({}))
  if (typeof body.publicSignupActive !== 'boolean') {
    return NextResponse.json({ error: 'publicSignupActive booléen requis' }, { status: 400 })
  }
  // Le singleton Configuration 'global' existe dès l'amorçage → update simple.
  await prisma.configuration.update({
    where: { id: 'global' },
    data: { publicSignupActive: body.publicSignupActive },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: (session!.user as { id: string }).id, ip: getClientIp(req),
    targetType: 'configuration', details: { scope: 'public-signup', publicSignupActive: body.publicSignupActive },
  })
  return NextResponse.json({ publicSignupActive: body.publicSignupActive })
}
