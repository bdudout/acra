import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole, peutDefinir2eLigne, peutDefinirKri, peutEcrireAudit, peutEvaluerDora, type UserRole } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { CATALOGUE_PACK_VERSION, SECTOR_CODES, searchSectorSuggestions, type CatalogueLocale, type SectorCode } from '@/lib/sector-suggestions'
import { newSince, oldestImportedVersion } from '@/lib/sector-suggestions-changelog'
import { planSuggestionSelection } from '@/lib/sector-suggestion-plan'

export const dynamic = 'force-dynamic'

const LOCALES: CatalogueLocale[] = ['fr', 'en', 'de', 'es', 'it']
const parseSector = (value: unknown): SectorCode | null | undefined =>
  value === null || value === 'TRANSVERSAL' || value === '' ? null
    : typeof value === 'string' && SECTOR_CODES.includes(value as SectorCode) ? value as SectorCode : undefined
const parseLocale = (value: unknown): CatalogueLocale => LOCALES.includes(value as CatalogueLocale) ? value as CatalogueLocale : 'fr'

async function context() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const userId = (session.user as { id: string }).id
  const instanceRole = (session.user as { role?: UserRole }).role ?? 'ANALYSTE'
  const scope = await getAnalyseScope(userId, instanceRole)
  return { userId, role: scope.role, orgId: scope.activeOrgId }
}

/** Aperçu sans écriture : statut de provenance stable par ligne, filtrage localisable. */
export async function GET(req: NextRequest) {
  const ctx = await context()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!ctx.orgId) return NextResponse.json({ error: 'organization_required' }, { status: 400 })
  const cfg = await getOrgConfig(ctx.orgId)
  if (!cfg.registreRisquesActive) return NextResponse.json({ error: 'module_inactive' }, { status: 403 })
  const url = new URL(req.url)
  const org = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { secteursActivite: true } })
  const configured = Array.isArray(org?.secteursActivite) ? org.secteursActivite.filter((s): s is SectorCode => SECTOR_CODES.includes(s as SectorCode)) : []
  const sector = url.searchParams.has('sector') ? parseSector(url.searchParams.get('sector')) : (configured[0] ?? null)
  if (sector === undefined) return NextResponse.json({ error: 'invalid_sector' }, { status: 400 })
  const locale = parseLocale(url.searchParams.get('locale'))
  const query = (url.searchParams.get('q') ?? '').slice(0, 120)
  const [processes, risks, controls, kris, audits, tests] = await Promise.all([
    prisma.processus.findMany({ where: { organizationId: ctx.orgId, catalogueKey: { not: null } }, select: { catalogueKey: true, catalogueVersion: true } }),
    prisma.riskItem.findMany({ where: { organizationId: ctx.orgId, catalogueKey: { not: null } }, select: { catalogueKey: true, catalogueVersion: true } }),
    cfg.controlePermanentActive ? prisma.controle.findMany({ where: { organizationId: ctx.orgId, catalogueKey: { not: null } }, select: { catalogueKey: true, catalogueVersion: true } }) : Promise.resolve([]),
    cfg.kriActive ? prisma.kri.findMany({ where: { organizationId: ctx.orgId, catalogueKey: { not: null } }, select: { catalogueKey: true, catalogueVersion: true } }) : Promise.resolve([]),
    cfg.auditInterneActive ? prisma.auditMission.findMany({ where: { organizationId: ctx.orgId, catalogueKey: { not: null } }, select: { catalogueKey: true, catalogueVersion: true } }) : Promise.resolve([]),
    cfg.reglementaireActive ? prisma.testResilience.findMany({ where: { organizationId: ctx.orgId, catalogueKey: { not: null } }, select: { catalogueKey: true, catalogueVersion: true } }) : Promise.resolve([]),
  ])
  const imported = [...processes, ...risks, ...controls, ...kris, ...audits, ...tests]
  const existing = new Set(imported.map(row => row.catalogueKey))
  // Les contrôles-types ne sont proposés que si le module « contrôle permanent » est activé pour l'organisation.
  const items = searchSectorSuggestions(sector, locale, query).filter(item => (item.kind !== 'CONTROL' || cfg.controlePermanentActive) && (item.kind !== 'KRI' || cfg.kriActive) && (item.kind !== 'AUDIT' || cfg.auditInterneActive) && (item.kind !== 'RESILIENCE_TEST' || cfg.reglementaireActive)).map(item => ({ ...item, status: existing.has(item.key) ? 'ALREADY_IMPORTED' : 'NEW' }))
  // Nouveautés depuis la plus ancienne version importée : des propositions à consulter, jamais une mise à jour automatique.
  const since = oldestImportedVersion(imported.map(row => row.catalogueVersion))
  const visibleKeys = new Set(items.map(item => item.key))
  const whatsNew = { since, keys: newSince(since, [...existing].filter((k): k is string => !!k)).filter(key => visibleKeys.has(key)) }
  return NextResponse.json({ sector, configuredSectors: configured, sectors: SECTOR_CODES, locale, version: CATALOGUE_PACK_VERSION, items, whatsNew })
}

/** Une confirmation explicite importe un sous-ensemble, jamais tout un pack implicite. */
export async function POST(req: NextRequest) {
  const ctx = await context()
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!ctx.orgId) return NextResponse.json({ error: 'organization_required' }, { status: 400 })
  const cfg = await getOrgConfig(ctx.orgId)
  if (!cfg.registreRisquesActive) return NextResponse.json({ error: 'module_inactive' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const sector = parseSector(body.sector)
  if (sector === undefined) return NextResponse.json({ error: 'invalid_sector' }, { status: 400 })
  const locale = parseLocale(body.locale)
  const selectedKeys = body.selectedKeys
  if (!Array.isArray(selectedKeys) || selectedKeys.length === 0 || selectedKeys.length > 100 || selectedKeys.some((key: unknown) => typeof key !== 'string')) {
    return NextResponse.json({ error: 'invalid_selection' }, { status: 400 })
  }
  const selectedPlan = planSuggestionSelection({ sector, locale, selectedKeys, existingKeys: [] })
  if (selectedPlan.invalidKeys.length) return NextResponse.json({ error: 'invalid_keys', invalidKeys: selectedPlan.invalidKeys }, { status: 400 })
  if (ctx.role === 'LECTEUR' || !ctx.role || (selectedPlan.toCreate.some(item => item.kind === 'PROCESS') && !isAdminRole(ctx.role))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (selectedPlan.toCreate.some(item => item.kind === 'CONTROL')) {
    if (!cfg.controlePermanentActive) return NextResponse.json({ error: 'module_inactive' }, { status: 403 })
    if (!peutDefinir2eLigne(ctx.role, { secondeLigneActive: cfg.secondeLigneActive })) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (selectedPlan.toCreate.some(item => item.kind === 'KRI')) {
    if (!cfg.kriActive) return NextResponse.json({ error: 'module_inactive' }, { status: 403 })
    if (!peutDefinirKri(ctx.role, { secondeLigneActive: cfg.secondeLigneActive })) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (selectedPlan.toCreate.some(item => item.kind === 'AUDIT')) {
    if (!cfg.auditInterneActive) return NextResponse.json({ error: 'module_inactive' }, { status: 403 })
    if (!peutEcrireAudit(ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (selectedPlan.toCreate.some(item => item.kind === 'RESILIENCE_TEST')) {
    // Programme de tests DORA : module « reporting réglementaire » et droit d'évaluation DORA (comme /api/tests-resilience).
    if (!cfg.reglementaireActive) return NextResponse.json({ error: 'module_inactive' }, { status: 403 })
    if (!peutEvaluerDora(ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const result = await prisma.$transaction(async tx => {
    // Le verrou protège la lecture de provenance et les créations concurrentes de cette route.
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${ctx.orgId}), hashtext('catalogue-suggestions'))::text`)
    const [processes, risks, controls, kris, audits, tests] = await Promise.all([
      tx.processus.findMany({ where: { organizationId: ctx.orgId!, catalogueKey: { not: null } }, select: { id: true, catalogueKey: true } }),
      tx.riskItem.findMany({ where: { organizationId: ctx.orgId!, catalogueKey: { not: null } }, select: { id: true, catalogueKey: true } }),
      tx.controle.findMany({ where: { organizationId: ctx.orgId!, catalogueKey: { not: null } }, select: { id: true, catalogueKey: true } }),
      tx.kri.findMany({ where: { organizationId: ctx.orgId!, catalogueKey: { not: null } }, select: { id: true, catalogueKey: true } }),
      tx.auditMission.findMany({ where: { organizationId: ctx.orgId!, catalogueKey: { not: null } }, select: { id: true, catalogueKey: true } }),
      tx.testResilience.findMany({ where: { organizationId: ctx.orgId!, catalogueKey: { not: null } }, select: { id: true, catalogueKey: true } }),
    ])
    const plan = planSuggestionSelection({
      sector, locale, selectedKeys,
      existingKeys: [...processes, ...risks, ...controls, ...kris, ...audits, ...tests].flatMap(row => row.catalogueKey ? [row.catalogueKey] : []),
    })
    if (plan.invalidKeys.length) return { status: 400 as const, error: 'invalid_keys', ...plan }
    if (plan.unlinked.length && body.acceptUnlinked !== true) return { status: 409 as const, error: 'unlinked_dependencies', ...plan }
    if (!isAdminRole(ctx.role!) && plan.toCreate.some(item => item.kind === 'PROCESS')) return { status: 403 as const, error: 'forbidden', ...plan }

    const processIds = new Map(processes.flatMap(row => row.catalogueKey ? [[row.catalogueKey, row.id] as const] : []))
    const created: Array<{ key: string; id: string; kind: string }> = []
    for (const item of plan.toCreate) {
      if (item.kind === 'PROCESS') {
        const process = await tx.processus.create({ data: {
          organizationId: ctx.orgId!, nom: item.title, parentId: item.parentKey ? processIds.get(item.parentKey) ?? null : null,
          catalogueKey: item.key, catalogueVersion: item.packVersion,
        } })
        processIds.set(item.key, process.id)
        created.push({ key: item.key, id: process.id, kind: item.kind })
      } else if (item.kind === 'CONTROL') {
        // Définition seule : aucune exécution, aucun responsable, aucune efficacité ; périodicité et type sont des suggestions.
        const controle = await tx.controle.create({ data: {
          organizationId: ctx.orgId!, intitule: item.title, periodicite: item.periodicite ?? 'TRIMESTRIEL', typeControle: item.controlType ?? null,
          processusId: item.processKey ? processIds.get(item.processKey) ?? null : null,
          catalogueKey: item.key, catalogueVersion: item.packVersion,
        } })
        created.push({ key: item.key, id: controle.id, kind: item.kind })
      } else if (item.kind === 'AUDIT') {
        // Mission PLANIFIÉE : programme de revue à adapter ; ni dates, ni notation, ni constat, ni indépendance déclarée.
        const mission = await tx.auditMission.create({ data: {
          organizationId: ctx.orgId!, intitule: item.title, statut: 'PLANIFIEE', programme: item.points ?? [],
          processusIds: item.processKey && processIds.get(item.processKey) ? [processIds.get(item.processKey)!] : [],
          catalogueKey: item.key, catalogueVersion: item.packVersion,
        } })
        created.push({ key: item.key, id: mission.id, kind: item.kind })
      } else if (item.kind === 'RESILIENCE_TEST') {
        // Test PLANIFIÉ de l'année en cours, à qualifier : ni date, ni testeur désigné, ni résultat, ni constat.
        // Ni fonction critique ni indépendance présumées (false) : l'entité les déclare en connaissance de cause.
        const test = await tx.testResilience.create({ data: {
          organizationId: ctx.orgId!, annee: new Date().getFullYear(), intitule: item.title, type: item.testType!,
          statut: 'PLANIFIE', fonctionCritique: false, independant: false,
          processusId: item.processKey ? processIds.get(item.processKey) ?? null : null,
          createdById: ctx.userId, catalogueKey: item.key, catalogueVersion: item.packVersion,
        } })
        created.push({ key: item.key, id: test.id, kind: item.kind })
      } else if (item.kind === 'KRI') {
        // Indicateur candidat : seuils à définir (null), aucune mesure ; le statut reste « inconnu » tant que l'organisation ne les fixe pas.
        const kri = await tx.kri.create({ data: {
          organizationId: ctx.orgId!, intitule: item.title, unite: item.unite ?? null, sens: item.sens ?? 'HAUSSE',
          frequence: item.periodicite && item.periodicite !== 'HEBDOMADAIRE' ? item.periodicite : 'MENSUEL',
          seuilAlerte: null, seuilCritique: null,
          processusId: item.processKey ? processIds.get(item.processKey) ?? null : null,
          catalogueKey: item.key, catalogueVersion: item.packVersion,
        } })
        created.push({ key: item.key, id: kri.id, kind: item.kind })
      } else {
        const risk = await tx.riskItem.create({ data: {
          organizationId: ctx.orgId!, intitule: item.title,
          processusId: item.processKey ? processIds.get(item.processKey) ?? null : null,
          catalogueKey: item.key, catalogueVersion: item.packVersion,
          provenance: 'ACRA', sourceType: 'catalogue', sourceId: item.key, statut: 'IDENTIFIE',
          graviteInherente: null, vraisemblanceInherente: null,
        } })
        created.push({ key: item.key, id: risk.id, kind: item.kind })
      }
    }
    return { status: created.length ? 201 as const : 200 as const, created, alreadyImported: plan.alreadyImported, unlinked: plan.unlinked, version: CATALOGUE_PACK_VERSION }
  })
  if ('error' in result) return NextResponse.json(result, { status: result.status })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: ctx.userId, userRole: ctx.role ?? undefined, organizationId: ctx.orgId, ip: getClientIp(req),
    details: { scope: 'catalogue-suggestions', action: 'import', sector, created: result.created.map(item => item.key) },
  })
  return NextResponse.json(result, { status: result.status })
}
