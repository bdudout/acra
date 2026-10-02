import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { type UserRole } from '@/lib/permissions'
import { peutQualifier, loadIncidentInScope } from '@/lib/incident-access.server'
import { resolveIncidentsConfig } from '@/lib/incidents-config'
import { calculerHorloges, sanitizeAttributs, sanitizeNotifications } from '@/lib/notification-regimes'
import { buildDoraReportJson, buildNotificationJson, cleanDeclaration, deriveDeclaration, DORA_STAGES, type DeclarationIncident, type DoraStage } from '@/lib/incident-declaration'
import { buildDeclarationWorkbook, type DeclarationExport, type ExportLang } from '@/lib/incident-declaration-xlsx'
import type { DoraCriteres } from '@/lib/dora'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// Déclaration à une autorité : compléments de champs (ITS DORA) et fichiers JSON d'aide à la déclaration. 2ᵉ ligne seulement.
// Rien n'est transmis : l'entité dépose elle-même auprès de l'autorité compétente.
async function garde(params: Params['params']) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const { id } = await params
  const c = await loadIncidentInScope(session as unknown as { user: { id: string; role?: string } }, id)
  if ('error' in c) return { error: c.error as NextResponse }
  if (!peutQualifier(c.userRole as UserRole, c.secondeLigneActive)) return { error: NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 }) }
  return { c, id }
}

const num = (v: unknown) => (v == null ? null : Number(v))

// GET /api/incidents/[id]/declaration — sans paramètre : compléments saisis ;
// ?regime=DORA&stage=INITIAL|INTERMEDIATE|FINAL ou ?regime=<code>&phase=<code> : fichier JSON (&download=1 : pièce jointe).
export async function GET(req: NextRequest, ctx: Params): Promise<NextResponse> {
  const g = await garde(ctx.params)
  if ('error' in g) return g.error as NextResponse
  const { c, id } = g
  const row = await prisma.incident.findUnique({
    where: { id },
    select: {
      id: true, intitule: true, description: true, dateSurvenance: true, dateDetection: true, doraClasseMajeurLe: true, doraCriteres: true,
      montantBrut: true, recuperations: true, clotureLe: true, clotureCommentaire: true, causeRacine: true, causeDetail: true, typeEvenement: true, statut: true,
      attributs: true, notifications: true, declaration: true, catalogueKey: true, organization: { select: { nom: true } },
    },
  })
  if (!row) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const url = new URL(req.url)
  const regime = url.searchParams.get('regime')
  const declaration = cleanDeclaration(row.declaration)

  const cfg = resolveIncidentsConfig(c.incidentsConfig)
  const incident: DeclarationIncident = {
    id: row.id, intitule: row.intitule, description: row.description, dateSurvenance: row.dateSurvenance, dateDetection: row.dateDetection,
    doraClasseMajeurLe: row.doraClasseMajeurLe, doraCriteres: row.doraCriteres as DoraCriteres, montantBrut: num(row.montantBrut), recuperations: num(row.recuperations),
    clotureLe: row.clotureLe, clotureCommentaire: row.clotureCommentaire, causeRacine: row.causeRacine, causeDetail: row.causeDetail, typeEvenement: row.typeEvenement, catalogueKey: row.catalogueKey, statut: row.statut,
  }
  const context = { organisationNom: row.organization.nom, devise: cfg.deviseReference, now: new Date() }
  // Sans paramètre : compléments saisis ET valeurs que le fichier reprendrait de l'incident (affichées comme valeurs proposées).
  if (!regime) return NextResponse.json({ declaration, derived: deriveDeclaration(incident, context) })

  const format = url.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'json'
  const lang = (['fr', 'en', 'de', 'es', 'it'].includes(url.searchParams.get('lang') ?? '') ? url.searchParams.get('lang') : 'fr') as ExportLang
  let what: DeclarationExport; let name: string; let json: unknown
  if (regime === 'DORA') {
    const stage = (url.searchParams.get('stage') ?? '') as DoraStage
    if (!DORA_STAGES.includes(stage)) return NextResponse.json({ error: 'etape_invalide' }, { status: 400 })
    what = { kind: 'DORA', stage, declaration }
    json = buildDoraReportJson(incident, stage, declaration, context)
    name = `dora-${stage.toLowerCase()}-${row.id}`
  } else {
    const phase = url.searchParams.get('phase') ?? ''
    const r = cfg.regimes.find(x => x.code === regime)
    const p = r?.phases.find(x => x.code === phase)
    if (!r || !p) return NextResponse.json({ error: 'regime_invalide' }, { status: 400 })
    const h = calculerHorloges({ connaissance: row.dateDetection, attributs: { ...sanitizeAttributs(row.attributs), regimes: [r.code] }, notifications: sanitizeNotifications(row.notifications) }, [{ ...r, actif: true }], context.now)[0]?.phases.find(x => x.code === phase)
    const n = { code: r.code, label: r.label, autorite: r.autorite, phase: { code: p.code, label: p.label }, echeance: h?.echeance ?? null, soumisLe: h?.soumisLe ?? null, reference: h?.reference }
    what = { kind: 'REGIME', ...n, declaration }
    json = buildNotificationJson(incident, n, context, declaration)
    name = `${r.code.toLowerCase()}-${p.code.toLowerCase()}-${row.id}`
  }
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole as string, organizationId: c.incident.organizationId, ip: getClientIp(req),
    details: { scope: 'incident', action: 'declaration-export', id, regime, format },
  })
  const download = url.searchParams.get('download') === '1'
  if (format === 'xlsx') {
    const buf = await buildDeclarationWorkbook(what, incident, context, lang)
    return new NextResponse(buf as unknown as BodyInit, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${name}.xlsx"`, 'Cache-Control': 'no-store' } })
  }
  const headers: Record<string, string> = download ? { 'Content-Disposition': `attachment; filename="${name}.json"` } : {}
  return NextResponse.json(json, { headers })
}

// PUT /api/incidents/[id]/declaration — enregistre les compléments (champs ITS éditables, bornés).
export async function PUT(req: NextRequest, ctx: Params): Promise<NextResponse> {
  const g = await garde(ctx.params)
  if ('error' in g) return g.error as NextResponse
  const { c, id } = g
  const body = await req.json().catch(() => ({}))
  const declaration = cleanDeclaration(body.declaration)
  await prisma.incident.update({ where: { id }, data: { declaration: declaration as unknown as Prisma.InputJsonValue } })
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId: c.userId, userRole: c.userRole as string, organizationId: c.incident.organizationId, ip: getClientIp(req),
    details: { scope: 'incident', action: 'declaration-update', id, champs: Object.keys(declaration).length },
  })
  return NextResponse.json({ declaration })
}
