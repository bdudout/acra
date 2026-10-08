import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { encryptSecret } from '@/lib/secret-crypto'
import { mergeEntitySyncConfig, publicEntitySyncConfig, validateLdapEndpoint, validateSyncEndpoint, type EntitySyncConfig } from '@/lib/entity-sync'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'
import { auditLog } from '@/lib/logger'
import { redactSecrets } from '@/lib/audit-redact'
import { upsertOrgConfig } from '@/lib/org-config.server'

type Params = { params: Promise<{ orgId: string }> }
const schema = z.object({ type: z.enum(['REST', 'LDAP']), endpoint: z.string().max(2000), token: z.string().max(2048).optional(), bindDN: z.string().max(512).optional(), password: z.string().max(1024).optional(), baseDN: z.string().max(512).optional(), filter: z.string().max(512).optional() })

async function guard(orgId: string): Promise<{ user?: { id: string; email?: string | null }; status: 401 | 403 | null }> {
  const session = await getServerSession(authOptions); if (!session?.user) return { status: 401 }
  const user = session.user as { id: string; role?: UserRole }
  const role = await getEffectiveRoleForOrg(user.id, user.role ?? 'ANALYSTE', orgId)
  return role && isAdminRole(role) ? { user, status: null } : { status: 403 }
}

function storedConfig(value: unknown): EntitySyncConfig {
  return value && typeof value === 'object' ? value as EntitySyncConfig : {}
}

export async function GET(_: NextRequest, { params }: Params) {
  const { orgId } = await params; const access = await guard(orgId)
  if (access.status) return NextResponse.json({ error: access.status === 401 ? 'Non authentifié' : 'Accès refusé' }, { status: access.status })
  const row = await prisma.organizationConfig.findUnique({ where: { id: orgId }, select: { entitesSyncConfig: true } })
  return NextResponse.json(publicEntitySyncConfig(storedConfig(row?.entitesSyncConfig)))
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { orgId } = await params; const access = await guard(orgId)
  if (access.status) return NextResponse.json({ error: access.status === 401 ? 'Non authentifié' : 'Accès refusé' }, { status: access.status })
  const rl = await rateLimit(`entites-sync-config:${access.user!.id}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  const parsed = schema.safeParse(await req.json().catch(() => ({}))); if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  const data = parsed.data
  if ((data.type === 'REST' && !validateSyncEndpoint(data.endpoint)) || (data.type === 'LDAP' && !validateLdapEndpoint(data.endpoint))) return NextResponse.json({ error: 'Endpoint invalide' }, { status: 400 })
  const previous = await prisma.organizationConfig.findUnique({ where: { id: orgId }, select: { entitesSyncConfig: true } })
  const merged = mergeEntitySyncConfig(storedConfig(previous?.entitesSyncConfig), data)
  if (data.type === 'LDAP' && (!merged.bindDN?.trim() || !merged.password || !merged.baseDN?.trim())) return NextResponse.json({ error: 'Configuration LDAP incomplète' }, { status: 400 })
  const config = { ...merged, token: encryptSecret(merged.token), password: encryptSecret(merged.password) }
  await upsertOrgConfig(orgId, { entitesSyncConfig: config })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: access.user!.id, userEmail: access.user!.email ?? undefined, organizationId: orgId, targetId: orgId, targetType: 'entity-sync-config', details: redactSecrets(data, ['token', 'password']) })
  return NextResponse.json(publicEntitySyncConfig(config), { headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
}
