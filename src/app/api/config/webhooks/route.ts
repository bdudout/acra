import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { cleanWebhookEvents, isSafeWebhookUrl } from '@/lib/webhook'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function ctx(session: { user: { id: string; role?: string } }) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  return { userId, userRole: scope.role, orgId: scope.activeOrgId }
}

// GET /api/config/webhooks — liste des webhooks de l'org active (ADMIN, secret masqué).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!isAdminRole(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  if (!orgId) return NextResponse.json({ webhooks: [] })

  const rows = await prisma.webhook.findMany({
    where: { organizationId: orgId },
    orderBy: [{ createdAt: 'desc' }],
    select: { id: true, name: true, url: true, events: true, actif: true, createdAt: true },
  })
  return NextResponse.json({ webhooks: rows })
}

// POST /api/config/webhooks — crée un webhook ; renvoie le SECRET une seule fois (ADMIN).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!isAdminRole(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : 'Webhook'
  const url = typeof body.url === 'string' ? body.url.trim() : ''
  if (!isSafeWebhookUrl(url)) return NextResponse.json({ error: 'url_invalide' }, { status: 400 })
  const events = cleanWebhookEvents(body.events)
  if (events.length === 0) return NextResponse.json({ error: 'events_requis' }, { status: 400 })

  const secret = `whsec_${randomBytes(24).toString('base64url')}`
  const created = await prisma.webhook.create({
    data: { organizationId: orgId, name, url, secret, events, createdBy: userId },
    select: { id: true, name: true, url: true, events: true, actif: true, createdAt: true },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'webhook', action: 'create', id: created.id, events },
  })
  // secret de signature renvoyé UNE fois — non re-consultable ensuite.
  return NextResponse.json({ ...created, secret }, { status: 201 })
}
