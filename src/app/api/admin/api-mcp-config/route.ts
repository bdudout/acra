import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Interfaces programmatiques (API v1, MCP) — réglage d'INSTANCE réservé au
// SUPER_ADMIN, sur toute instance. Désactivées par défaut.
async function requireSuperAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }), session: null }
  if ((session.user as { role?: string }).role !== 'SUPER_ADMIN') {
    return { error: NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 }), session: null }
  }
  return { error: null, session }
}

// GET /api/admin/api-mcp-config — état des interrupteurs API v1 et MCP.
export async function GET() {
  const { error } = await requireSuperAdmin()
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
  const { error, session } = await requireSuperAdmin()
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
