import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { requireInstanceAdmin } from '@/lib/route-guard.server'

export const dynamic = 'force-dynamic'


// GET /api/admin/public-signup — état du toggle d'inscription publique.
export async function GET() {
  const { error } = await requireInstanceAdmin()
  if (error) return error
  const config = await prisma.configuration.findUnique({ where: { id: 'global' }, select: { publicSignupActive: true } })
  return NextResponse.json({ publicSignupActive: config?.publicSignupActive === true })
}

// PUT /api/admin/public-signup — activer/désactiver l'inscription publique.
export async function PUT(req: NextRequest) {
  const { error, session } = await requireInstanceAdmin()
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
