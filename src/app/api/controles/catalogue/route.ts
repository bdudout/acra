// ─── Catalogue unifié des contrôles-types : aperçu et import ligne par ligne ─────
// GET  ?locale=fr : modèles (par référentiel ET du catalogue sectoriel), état pour l'organisation
//      (NEW, ALREADY_IMPORTED par clé, SIMILAR si un contrôle porte déjà cet intitulé), processus et
//      risques de rattachement, et ceux que l'organisation possède déjà (liens possibles).
// POST { keys, locale } : crée les contrôles choisis. Lien au processus / au risque SEULEMENT si
//      l'organisation les a déjà (même clé de catalogue) ; jamais d'exécution ni de responsable.
// Droits : définition 2ᵉ ligne (peutDefinir2eLigne) et module « contrôle permanent » actif.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutDefinir2eLigne, type UserRole } from '@/lib/permissions'
import { cleanControleInput } from '@/lib/controle'
import { listControlTemplates } from '@/lib/controle-templates'
import { orgSectors } from '@/lib/sector-context.server'
import type { CatalogueLocale } from '@/lib/sector-suggestions'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const LOCALES: CatalogueLocale[] = ['fr', 'en', 'de', 'es', 'it']
const parseLocale = (v: unknown): CatalogueLocale => (LOCALES.includes(v as CatalogueLocale) ? v as CatalogueLocale : 'fr')
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

async function context() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false as const, response: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return { ok: false as const, response: NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 }) }
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.controlePermanentActive) return { ok: false as const, response: NextResponse.json({ error: 'Module non activé' }, { status: 403 }) }
  if (!peutDefinir2eLigne(scope.role, { secondeLigneActive: cfg.secondeLigneActive })) return { ok: false as const, response: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  return { ok: true as const, userId, role: scope.role, orgId: scope.activeOrgId }
}

async function linkable(orgId: string) {
  const [processes, risks] = await Promise.all([
    prisma.processus.findMany({ where: { organizationId: orgId, catalogueKey: { not: null } }, select: { id: true, catalogueKey: true } }),
    prisma.riskItem.findMany({ where: { organizationId: orgId, catalogueKey: { not: null } }, select: { id: true, catalogueKey: true } }),
  ])
  return {
    processIds: new Map(processes.map(p => [p.catalogueKey!, p.id])),
    riskIds: new Map(risks.map(r => [r.catalogueKey!, r.id])),
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await context()
  if (!ctx.ok) return ctx.response
  const locale = parseLocale(new URL(req.url).searchParams.get('locale'))
  const { effective } = await orgSectors(ctx.orgId)
  const catalogue = listControlTemplates(effective, locale)
  const [existing, links] = await Promise.all([
    prisma.controle.findMany({ where: { organizationId: ctx.orgId }, select: { intitule: true, catalogueKey: true } }),
    linkable(ctx.orgId),
  ])
  const keys = new Set(existing.map(c => c.catalogueKey).filter(Boolean))
  const titles = new Set(existing.map(c => norm(c.intitule)))
  return NextResponse.json({
    ...catalogue,
    templates: catalogue.templates.map(t => ({ ...t, status: keys.has(t.key) ? 'ALREADY_IMPORTED' : titles.has(norm(t.title)) ? 'SIMILAR' : 'NEW' })),
    ownedProcessKeys: [...links.processIds.keys()],
    ownedRiskKeys: [...links.riskIds.keys()],
  })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await context()
  if (!ctx.ok) return ctx.response
  const body = await req.json().catch(() => ({}))
  const locale = parseLocale(body.locale)
  const { effective } = await orgSectors(ctx.orgId)
  const templates = new Map(listControlTemplates(effective, locale).templates.map(t => [t.key, t]))
  const keys: unknown = body.keys
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > 200 || keys.some(k => typeof k !== 'string' || !templates.has(k))) {
    return NextResponse.json({ error: 'invalid_keys' }, { status: 400 })
  }
  const selected = [...new Set(keys as string[])]
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${ctx.orgId}), hashtext('controle-catalogue'))::text`)
    const already = new Set((await tx.controle.findMany({ where: { organizationId: ctx.orgId, catalogueKey: { in: selected } }, select: { catalogueKey: true } })).map(c => c.catalogueKey))
    const { processIds, riskIds } = await linkable(ctx.orgId)
    const created: string[] = []
    for (const key of selected.filter(k => !already.has(k))) {
      const t = templates.get(key)!
      const riskItemId = t.riskKeys.map(k => riskIds.get(k)).find(Boolean) ?? null
      const data = cleanControleInput({
        intitule: t.title, description: t.description ?? null, niveau: t.niveau ?? 'N1', periodicite: t.periodicite,
        referentielCode: t.referentiel?.code ?? null, exigenceRefs: t.referentiel?.exigenceRefs ?? [], checklist: t.checklist,
        processusId: t.processKey ? processIds.get(t.processKey) ?? null : null, riskItemId,
      })
      await tx.controle.create({ data: { ...data, typeControle: t.controlType ?? null, organizationId: ctx.orgId, catalogueKey: key, catalogueVersion: t.version } })
      created.push(key)
    }
    return { created, alreadyImported: [...already] }
  })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: ctx.userId, userRole: ctx.role ?? undefined, organizationId: ctx.orgId, ip: getClientIp(req),
    details: { scope: 'controle', action: 'catalogue-import', created: result.created, alreadyImported: result.alreadyImported },
  })
  return NextResponse.json(result, { status: result.created.length ? 201 : 200 })
}
