// ─── Traitements types du registre RGPD : aperçu et import ligne par ligne ─────
// GET  ?locale=fr : traitements types traduits (ceux du secteur de l'organisation en tête), avec leur état pour l'organisation
//      (NEW, ALREADY_IMPORTED par clé de catalogue, SIMILAR si un traitement porte déjà ce nom).
// POST { keys, locale } : crée les traitements sélectionnés (provenance catalogueKey, idempotent,
//      jamais de fusion avec un traitement existant). Réservé à canManageRopa (DPO / ADMIN).
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { canManageRopa } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { listRopaTemplates, ROPA_CATALOGUE_VERSION, type RopaLocale } from '@/lib/ropa-catalogue'
import { auditLog, getClientIp } from '@/lib/logger'
import { orgSectors } from '@/lib/sector-context.server'

export const dynamic = 'force-dynamic'

const LOCALES: RopaLocale[] = ['fr', 'en', 'de', 'es', 'it']
const parseLocale = (v: unknown): RopaLocale => (LOCALES.includes(v as RopaLocale) ? v as RopaLocale : 'fr')
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

export const GET = withAccess({ org: 'active', allow: canManageRopa }, async (req: NextRequest, { orgId }) => {
  const locale = parseLocale(new URL(req.url).searchParams.get('locale'))
  const existing = await prisma.traitement.findMany({ where: { organizationId: orgId }, select: { nom: true, catalogueKey: true } })
  const keys = new Set(existing.map(t => t.catalogueKey).filter(Boolean))
  const names = new Set(existing.map(t => norm(t.nom)))
  const secteurs = (await orgSectors(orgId)).effective
  const items = listRopaTemplates(locale, secteurs).map(t => ({ ...t, status: keys.has(t.key) ? 'ALREADY_IMPORTED' : names.has(norm(t.nom)) ? 'SIMILAR' : 'NEW' }))
  return NextResponse.json({ version: ROPA_CATALOGUE_VERSION, locale, items })
})

export const POST = withAccess({ org: 'active', allow: canManageRopa, rateLimit: { bucket: 'ropa' } }, async (req: NextRequest, { user, role, orgId }) => {
  const body = await req.json().catch(() => ({}))
  const locale = parseLocale(body.locale)
  const templates = new Map(listRopaTemplates(locale, (await orgSectors(orgId)).effective).map(t => [t.key, t]))
  const keys: unknown = body.keys
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > templates.size || keys.some(k => typeof k !== 'string' || !templates.has(k))) {
    return NextResponse.json({ error: 'invalid_keys' }, { status: 400 })
  }
  const selected = [...new Set(keys as string[])]
  const result = await prisma.$transaction(async tx => {
    // Verrou par organisation : deux imports simultanés ne créent pas deux fois le même traitement.
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${orgId}), hashtext('ropa-catalogue'))::text`)
    const already = new Set((await tx.traitement.findMany({ where: { organizationId: orgId, catalogueKey: { in: selected } }, select: { catalogueKey: true } })).map(t => t.catalogueKey))
    const toCreate = selected.filter(k => !already.has(k))
    for (const key of toCreate) {
      const { key: _key, ...data } = templates.get(key)!
      await tx.traitement.create({ data: { ...data, organizationId: orgId, createdBy: user.id, catalogueKey: key, catalogueVersion: ROPA_CATALOGUE_VERSION } })
    }
    return { created: toCreate, alreadyImported: [...already] }
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'ropa', action: 'catalogue-import', created: result.created, alreadyImported: result.alreadyImported },
  })
  return NextResponse.json(result, { status: result.created.length ? 201 : 200 })
})
