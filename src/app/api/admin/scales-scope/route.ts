import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { ROOT_ORG_ID } from '@/lib/configuration-server'
import { auditLog, getClientIp } from '@/lib/logger'
import { requireInstanceAdmin } from '@/lib/route-guard.server'


// GET — mode de portée des échelles (SHARED = groupe · PER_ORG = consultant)
export async function GET() {
  const auth = await requireInstanceAdmin()
  if (auth.error) return auth.error
  const row = await prisma.organizationConfig.findUnique({ where: { id: ROOT_ORG_ID }, select: { scalesScope: true } })
  return NextResponse.json({ scalesScope: (row as any)?.scalesScope === 'PER_ORG' ? 'PER_ORG' : 'SHARED' })
}

const schema = z.object({ scalesScope: z.enum(['SHARED', 'PER_ORG']) })

// PUT — définir le mode de portée des échelles (instance, stocké sur la racine)
export async function PUT(req: NextRequest) {
  const auth = await requireInstanceAdmin()
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
