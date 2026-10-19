import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { isAdminRole } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { encryptSecret } from '@/lib/secret-crypto'
import { mergeEntitySyncConfig, publicEntitySyncConfig, validateLdapEndpoint, validateSyncEndpoint, type EntitySyncConfig } from '@/lib/entity-sync'
import { rateLimitHeaders } from '@/lib/rate-limit'
import { auditLog } from '@/lib/logger'
import { redactSecrets } from '@/lib/audit-redact'
import { upsertOrgConfig } from '@/lib/org-config.server'

const schema = z.object({ type: z.enum(['REST', 'LDAP']), endpoint: z.string().max(2000), token: z.string().max(2048).optional(), bindDN: z.string().max(512).optional(), password: z.string().max(1024).optional(), baseDN: z.string().max(512).optional(), filter: z.string().max(512).optional(), sourceVerite: z.enum(['ACRA', 'ANNUAIRE']).optional() })

const ADMIN_ORG = { org: { param: 'orgId' }, allow: isAdminRole } as const

function storedConfig(value: unknown): EntitySyncConfig {
  return value && typeof value === 'object' ? value as EntitySyncConfig : {}
}

export const GET = withAccess(ADMIN_ORG, async (_req, { orgId }) => {
  const row = await prisma.organizationConfig.findUnique({ where: { id: orgId }, select: { entitesSyncConfig: true } })
  return NextResponse.json(publicEntitySyncConfig(storedConfig(row?.entitesSyncConfig)))
})

export const PUT = withAccess({ ...ADMIN_ORG, rateLimit: { bucket: 'entites-sync-config' }, body: schema }, async (_req, { user, orgId, body: data, rl }) => {
  if ((data.type === 'REST' && !validateSyncEndpoint(data.endpoint)) || (data.type === 'LDAP' && !validateLdapEndpoint(data.endpoint))) return NextResponse.json({ error: 'Endpoint invalide' }, { status: 400 })
  const previous = await prisma.organizationConfig.findUnique({ where: { id: orgId }, select: { entitesSyncConfig: true } })
  const merged = mergeEntitySyncConfig(storedConfig(previous?.entitesSyncConfig), data)
  if (data.type === 'LDAP' && (!merged.bindDN?.trim() || !merged.password || !merged.baseDN?.trim())) return NextResponse.json({ error: 'Configuration LDAP incomplète' }, { status: 400 })
  const config = { ...merged, token: encryptSecret(merged.token), password: encryptSecret(merged.password) }
  await upsertOrgConfig(orgId, { entitesSyncConfig: config })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: user.id, userEmail: user.email ?? undefined, organizationId: orgId, targetId: orgId, targetType: 'entity-sync-config', details: redactSecrets(data, ['token', 'password']) })
  return NextResponse.json(publicEntitySyncConfig(config), { headers: rl ? rateLimitHeaders(rl.remaining, rl.resetAt) : {} })
})
