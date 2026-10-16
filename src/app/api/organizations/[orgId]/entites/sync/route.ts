/** Aperçu puis application explicite d'un connecteur d'entités.
 * Aucune entité n'est créée automatiquement : l'administrateur sélectionne les
 * intitulés à conserver dans le référentiel des responsables de mesures. */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isAdminRole } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { normalizeExternalEntities } from '@/lib/entity-sync'
import { configConnecteur, lireConnecteur } from '@/lib/entity-sync.server'
import { rateLimitHeaders } from '@/lib/rate-limit'
import { auditLog, getClientIp } from '@/lib/logger'
import { childPath } from '@/lib/org-context'
import { upsertOrgConfig } from '@/lib/org-config.server'

const schema = z.object({ operation: z.enum(['preview', 'import']), destination: z.enum(['MEASURE_OWNERS', 'ORGANIZATION_TREE']).default('MEASURE_OWNERS'), entities: z.array(z.string().min(1).max(120)).max(500).optional() })

function slugify(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'entite'
}

export const POST = withAccess({ org: { param: 'orgId' }, allow: isAdminRole, rateLimit: { bucket: 'entites-sync' }, body: schema }, async (req, { user, orgId, body, rl: limite }) => {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, path: true } })
  if (!org) return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 })
  const entetes = limite ? rateLimitHeaders(limite.remaining, limite.resetAt) : {}
  const row = await prisma.organizationConfig.findUnique({ where: { id: orgId }, select: { entitesSyncConfig: true, entitesMesures: true } })
  if (body.operation === 'preview') {
    try {
      const entities = await lireConnecteur(configConnecteur(row?.entitesSyncConfig))
      const existing = body.destination === 'ORGANIZATION_TREE'
        ? (await prisma.organization.findMany({ where: { parentId: orgId }, select: { nom: true }, take: 500 })).map(org => org.nom)
        : normalizeExternalEntities(Array.isArray(row?.entitesMesures) ? row.entitesMesures.map(name => ({ name })) : [])
      return NextResponse.json({ entities, existing, newEntities: entities.filter(name => !existing.some(current => current.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)) }, { headers: entetes })
    } catch {
      return NextResponse.json({ error: 'Connexion au connecteur impossible. Vérifiez sa configuration et ses droits.' }, { status: 422, headers: entetes })
    }
  }

  const selected = normalizeExternalEntities((body.entities ?? []).map(name => ({ name })))
  if (!selected.length) return NextResponse.json({ error: 'Sélectionnez au moins une entité' }, { status: 400 })
  if (body.destination === 'ORGANIZATION_TREE') {
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
        await tx.organization.update({ where: { id: newEntity.id }, data: { path: childPath(org.path, newEntity.id) } })
        return newEntity
      })
      created.push(entity.nom)
    }
    await auditLog('ORG_CREATED', { userId: user.id, userEmail: user.email ?? undefined, organizationId: orgId, targetId: orgId, targetType: 'entity-sync-import', ip: getClientIp(req), details: { selected: selected.length, created: created.length } })
    return NextResponse.json({ imported: created, total: existing.length + created.length }, { headers: entetes })
  }
  const existing = normalizeExternalEntities(Array.isArray(row?.entitesMesures) ? row.entitesMesures.map(name => ({ name })) : [])
  const merged = normalizeExternalEntities([...existing, ...selected].map(name => ({ name })))
  await upsertOrgConfig(orgId, { entitesMesures: merged })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: user.id, userEmail: user.email ?? undefined, organizationId: orgId, targetId: orgId, targetType: 'entity-sync-import', ip: getClientIp(req), details: { selected: selected.length, total: merged.length } })
  return NextResponse.json({ imported: selected, total: merged.length }, { headers: entetes })
})
