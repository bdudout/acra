import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { canManageOrganizations } from '@/lib/permissions'
import { ROOT_ORG_ID } from '@/lib/configuration-server'
import { auditLog, getClientIp } from '@/lib/logger'

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const role = (session.user as any).role ?? 'ANALYSTE'
  if (!canManageOrganizations({ id: (session.user as any).id, role })) {
    return { error: NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 }) }
  }
  return { session }
}

// GET — mode de portée des échelles (SHARED = groupe · PER_ORG = consultant)
export async function GET() {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error
  const row = await prisma.organizationConfig.findUnique({ where: { id: ROOT_ORG_ID }, select: { scalesScope: true } })
  return NextResponse.json({ scalesScope: (row as any)?.scalesScope === 'PER_ORG' ? 'PER_ORG' : 'SHARED' })
}

const schema = z.object({ scalesScope: z.enum(['SHARED', 'PER_ORG']) })

// PUT — définir le mode de portée des échelles (instance, stocké sur la racine)
export async function PUT(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  let scalesScope: 'SHARED' | 'PER_ORG'
  try {
    scalesScope = schema.parse(await req.json()).scalesScope
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  await prisma.organizationConfig.upsert({
    where: { id: ROOT_ORG_ID },
    create: { id: ROOT_ORG_ID, scalesScope },
    update: { scalesScope },
  })

  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: (auth.session!.user as any).id,
    targetId: ROOT_ORG_ID, targetType: 'organization',
    ip: getClientIp(req),
    details: { scalesScope },
  })
  return NextResponse.json({ scalesScope })
}
