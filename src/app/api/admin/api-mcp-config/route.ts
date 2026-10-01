import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'
import { requireInstanceAdmin } from '@/lib/route-guard.server'

export const dynamic = 'force-dynamic'


// GET /api/admin/api-mcp-config — état des interrupteurs API v1 et MCP.
export async function GET() {
  const { error } = await requireInstanceAdmin()
  if (error) return error
  const config = await prisma.configuration.findUnique({
    where: { id: 'global' },
    select: { apiEnabled: true, mcpEnabled: true },
  })
  return NextResponse.json({
    apiEnabled: config?.apiEnabled === true,
    mcpEnabled: config?.mcpEnabled === true,
  })
}

// PUT /api/admin/api-mcp-config — activer/désactiver l'API v1 et/ou MCP.
export async function PUT(req: NextRequest) {
  const { error, session } = await requireInstanceAdmin()
  if (error) return error
  const body = await req.json().catch(() => ({}))

  // Mise à jour partielle : seuls les booléens fournis sont modifiés.
  const data: { apiEnabled?: boolean; mcpEnabled?: boolean } = {}
  if ('apiEnabled' in body) {
    if (typeof body.apiEnabled !== 'boolean') return NextResponse.json({ error: 'apiEnabled booléen requis' }, { status: 400 })
    data.apiEnabled = body.apiEnabled
  }
  if ('mcpEnabled' in body) {
    if (typeof body.mcpEnabled !== 'boolean') return NextResponse.json({ error: 'mcpEnabled booléen requis' }, { status: 400 })
    data.mcpEnabled = body.mcpEnabled
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Aucun toggle fourni (apiEnabled / mcpEnabled)' }, { status: 400 })
  }

  const updated = await prisma.configuration.update({
    where: { id: 'global' },
    data,
    select: { apiEnabled: true, mcpEnabled: true },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: (session!.user as { id: string }).id, ip: getClientIp(req),
    targetType: 'configuration', details: { scope: 'api-mcp-config', ...data },
  })
  return NextResponse.json({ apiEnabled: updated.apiEnabled, mcpEnabled: updated.mcpEnabled })
}
