import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { generateApiKey, hashApiKey, cleanScopes, maskApiKey } from '@/lib/api-key'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function ctx(session: { user: { id: string; role?: string } }) {
  const userId = session.user.id
  const instanceRole = (session.user.role ?? 'ANALYSTE') as UserRole
  const scope = await getAnalyseScope(userId, instanceRole)
  return { userId, userRole: scope.role, orgId: scope.activeOrgId }
}

// GET /api/config/api-keys — liste des clés (masquées) de l'organisation active (ADMIN).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!isAdminRole(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  if (!orgId) return NextResponse.json({ keys: [] })

  const rows = await prisma.apiKey.findMany({
    where: { organizationId: orgId },
    orderBy: [{ createdAt: 'desc' }],
    select: { id: true, name: true, prefix: true, scopes: true, createdAt: true, lastUsedAt: true, expiresAt: true, revokedAt: true },
  })
  const keys = rows.map(k => ({
    id: k.id, name: k.name, masque: maskApiKey(k.prefix), scopes: k.scopes,
    createdAt: k.createdAt, lastUsedAt: k.lastUsedAt, expiresAt: k.expiresAt,
    revoked: !!k.revokedAt, revokedAt: k.revokedAt,
  }))
  return NextResponse.json({ keys })
}

// POST /api/config/api-keys — crée une clé ; renvoie le SECRET une seule fois (ADMIN).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { userId, userRole, orgId } = await ctx(session as unknown as { user: { id: string; role?: string } })
  if (!isAdminRole(userRole)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : 'Clé d\'API'
  const scopes = cleanScopes(body.scopes)
  const expiresAt = typeof body.expiresAt === 'string' && body.expiresAt
    ? (Number.isNaN(new Date(body.expiresAt).getTime()) ? null : new Date(body.expiresAt))
    : null

  const gen = generateApiKey()
  const hashedKey = await hashApiKey(gen.plaintext)
  const created = await prisma.apiKey.create({
    data: { organizationId: orgId, name, prefix: gen.prefix, hashedKey, scopes, createdBy: userId, expiresAt },
    select: { id: true, name: true, prefix: true, scopes: true, createdAt: true, expiresAt: true },
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'api-key', action: 'create', id: created.id, scopes },
  })
  // secret renvoyé UNE fois — non re-consultable ensuite.
  return NextResponse.json({ ...created, secret: gen.plaintext }, { status: 201 })
}
