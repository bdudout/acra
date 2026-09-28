/** Aperçu puis application explicite d'un connecteur d'entités.
 * Aucune entité n'est créée automatiquement : l'administrateur sélectionne les
 * intitulés à conserver dans le référentiel des responsables de mesures. */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { isAdminRole, type UserRole } from '@/lib/permissions'
import { decryptSecret } from '@/lib/secret-crypto'
import { fetchLdapEntities, fetchRestEntities, normalizeExternalEntities, type EntitySyncConfig } from '@/lib/entity-sync'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'
import { auditLog, getClientIp } from '@/lib/logger'

type Params = { params: Promise<{ orgId: string }> }
const schema = z.object({ operation: z.enum(['preview', 'import']), entities: z.array(z.string().min(1).max(120)).max(500).optional() })

async function guard(orgId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  const user = session.user as { id: string; email?: string | null; role?: UserRole }
  const role = await getEffectiveRoleForOrg(user.id, user.role ?? 'ANALYSTE', orgId)
  if (!role || !isAdminRole(role)) return { error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  return { user }
}

function config(value: unknown): EntitySyncConfig { return value && typeof value === 'object' ? value as EntitySyncConfig : {} }

async function readConnector(cfg: EntitySyncConfig): Promise<string[]> {
  if (cfg.type === 'REST' && cfg.endpoint) return fetchRestEntities(cfg.endpoint, decryptSecret(cfg.token) ?? null)
  if (cfg.type === 'LDAP' && cfg.endpoint && cfg.bindDN && cfg.baseDN) {
    const password = decryptSecret(cfg.password)
    if (!password) throw new Error('connector_secret_unavailable')
    return fetchLdapEntities({ url: cfg.endpoint, bindDN: cfg.bindDN, password, baseDN: cfg.baseDN, filter: cfg.filter })
  }
  throw new Error('connector_not_configured')
}

export async function POST(req: NextRequest, { params }: Params) {
  const { orgId } = await params
  const access = await guard(orgId)
  if ('error' in access) return access.error
  const rl = await rateLimit(`entites-sync:${access.user.id}`, LIMIT_API_WRITE.limit, LIMIT_API_WRITE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })

  const row = await prisma.organizationConfig.findUnique({ where: { id: orgId }, select: { entitesSyncConfig: true, entitesMesures: true } })
  if (parsed.data.operation === 'preview') {
    try {
      const entities = await readConnector(config(row?.entitesSyncConfig))
      const existing = normalizeExternalEntities(Array.isArray(row?.entitesMesures) ? row.entitesMesures.map(name => ({ name })) : [])
      return NextResponse.json({ entities, existing, newEntities: entities.filter(name => !existing.some(current => current.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)) }, { headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
    } catch {
      return NextResponse.json({ error: 'Connexion au connecteur impossible. Vérifiez sa configuration et ses droits.' }, { status: 422, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
    }
  }

  const selected = normalizeExternalEntities((parsed.data.entities ?? []).map(name => ({ name })))
  if (!selected.length) return NextResponse.json({ error: 'Sélectionnez au moins une entité' }, { status: 400 })
  const existing = normalizeExternalEntities(Array.isArray(row?.entitesMesures) ? row.entitesMesures.map(name => ({ name })) : [])
  const merged = normalizeExternalEntities([...existing, ...selected].map(name => ({ name })))
  await prisma.organizationConfig.upsert({ where: { id: orgId }, create: { id: orgId, entitesMesures: merged }, update: { entitesMesures: merged } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: access.user.id, userEmail: access.user.email ?? undefined, organizationId: orgId, targetId: orgId, targetType: 'entity-sync-import', ip: getClientIp(req), details: { selected: selected.length, total: merged.length } })
  return NextResponse.json({ imported: selected, total: merged.length }, { headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
}
