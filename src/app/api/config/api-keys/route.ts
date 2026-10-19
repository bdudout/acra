import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { isAdminRole } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { generateApiKey, hashApiKey, cleanScopes, maskApiKey } from '@/lib/api-key'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET /api/config/api-keys — liste des clés (masquées) de l'organisation active (ADMIN).
// org: 'none' : sans organisation active, liste vide (et non 400).
export const GET = withAccess({ org: 'none' }, async (_req, { user }) => {
  const { role: userRole, activeOrgId: orgId } = await getAnalyseScope(user.id, user.role)
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
})

// POST /api/config/api-keys — crée une clé ; renvoie le SECRET une seule fois (ADMIN).
export const POST = withAccess({ org: 'active', allow: isAdminRole, rateLimit: { bucket: 'api-keys' } }, async (req, { user, role: userRole, orgId }) => {
  const userId = user.id
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
})
