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
import { safeFetch, resolvePublicAddress } from '@/lib/safe-fetch.server'
import { rateLimit, rateLimitHeaders, LIMIT_API_WRITE } from '@/lib/rate-limit'
import { auditLog, getClientIp } from '@/lib/logger'
import { childPath } from '@/lib/org-context'
import { upsertOrgConfig } from '@/lib/org-config.server'

type Params = { params: Promise<{ orgId: string }> }
const schema = z.object({ operation: z.enum(['preview', 'import']), destination: z.enum(['MEASURE_OWNERS', 'ORGANIZATION_TREE']).default('MEASURE_OWNERS'), entities: z.array(z.string().min(1).max(120)).max(500).optional() })

async function guard(orgId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  const user = session.user as { id: string; email?: string | null; role?: UserRole }
  const role = await getEffectiveRoleForOrg(user.id, user.role ?? 'ANALYSTE', orgId)
  if (!role || !isAdminRole(role)) return { error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, path: true } })
  if (!org) return { error: NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 }) }
  return { user, org }
}

function config(value: unknown): EntitySyncConfig { return value && typeof value === 'object' ? value as EntitySyncConfig : {} }

async function readConnector(cfg: EntitySyncConfig): Promise<string[]> {
  if (cfg.type === 'REST' && cfg.endpoint) return fetchRestEntities(cfg.endpoint, decryptSecret(cfg.token) ?? null, safeFetch)
  if (cfg.type === 'LDAP' && cfg.endpoint && cfg.bindDN && cfg.baseDN) {
    const password = decryptSecret(cfg.password)
    if (!password) throw new Error('connector_secret_unavailable')
    return fetchLdapEntities({ url: cfg.endpoint, bindDN: cfg.bindDN, password, baseDN: cfg.baseDN, filter: cfg.filter, resolveHost: resolvePublicAddress })
  }
  throw new Error('connector_not_configured')
}

function slugify(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'entite'
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
      const existing = parsed.data.destination === 'ORGANIZATION_TREE'
        ? (await prisma.organization.findMany({ where: { parentId: orgId }, select: { nom: true }, take: 500 })).map(org => org.nom)
        : normalizeExternalEntities(Array.isArray(row?.entitesMesures) ? row.entitesMesures.map(name => ({ name })) : [])
      return NextResponse.json({ entities, existing, newEntities: entities.filter(name => !existing.some(current => current.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)) }, { headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
    } catch {
      return NextResponse.json({ error: 'Connexion au connecteur impossible. Vérifiez sa configuration et ses droits.' }, { status: 422, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
    }
  }

  const selected = normalizeExternalEntities((parsed.data.entities ?? []).map(name => ({ name })))
  if (!selected.length) return NextResponse.json({ error: 'Sélectionnez au moins une entité' }, { status: 400 })
  if (parsed.data.destination === 'ORGANIZATION_TREE') {
    const existing = await prisma.organization.findMany({ where: { parentId: orgId }, select: { nom: true }, take: 500 })
    const existingNames = new Set(existing.map(org => org.nom.toLocaleLowerCase('fr')))
    const toCreate = selected.filter(name => !existingNames.has(name.toLocaleLowerCase('fr')))
    const created: string[] = []
    for (const name of toCreate) {
      const entity = await prisma.$transaction(async tx => {
        const base = slugify(name)
        let slug = base
        for (let i = 0; i < 50; i++) {
          if (!await tx.organization.findUnique({ where: { slug }, select: { id: true } })) break
          slug = `${base}-${i + 2}`.slice(0, 40)
        }
        const newEntity = await tx.organization.create({ data: { nom: name, slug, parentId: orgId, path: '/' }, select: { id: true, nom: true } })
        await tx.organization.update({ where: { id: newEntity.id }, data: { path: childPath(access.org.path, newEntity.id) } })
        return newEntity
      })
      created.push(entity.nom)
    }
    await auditLog('ORG_CREATED', { userId: access.user.id, userEmail: access.user.email ?? undefined, organizationId: orgId, targetId: orgId, targetType: 'entity-sync-import', ip: getClientIp(req), details: { selected: selected.length, created: created.length } })
    return NextResponse.json({ imported: created, total: existing.length + created.length }, { headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  }
  const existing = normalizeExternalEntities(Array.isArray(row?.entitesMesures) ? row.entitesMesures.map(name => ({ name })) : [])
  const merged = normalizeExternalEntities([...existing, ...selected].map(name => ({ name })))
  await upsertOrgConfig(orgId, { entitesMesures: merged })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: access.user.id, userEmail: access.user.email ?? undefined, organizationId: orgId, targetId: orgId, targetType: 'entity-sync-import', ip: getClientIp(req), details: { selected: selected.length, total: merged.length } })
  return NextResponse.json({ imported: selected, total: merged.length }, { headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
}
