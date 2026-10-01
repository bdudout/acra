import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutGererRegistreTic, type UserRole } from '@/lib/permissions'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_EXCEL_PARSE } from '@/lib/rate-limit'
import { checkTabularUpload } from '@/lib/import-file-format'
import { importErrorStatus } from '@/lib/import-errors'
import { loadTabularWorkbook } from '@/lib/tabular-workbook'
import { detectHistoricHeaderLayout } from '@/lib/historic-import'
import { readDataRows, readSheetSample } from '@/lib/excel-grid'
import { mapTicContractColumns, planTicContractImport, MAX_TIC_ROWS, type TicContractRow } from '@/lib/tic-contract-import'
import type { TierLite } from '@/lib/tier-identity'

export const dynamic = 'force-dynamic'

const schema = z.object({
  filename: z.string().max(255), data: z.string().min(1).max(14_000_000),
  dryRun: z.boolean().optional(),
  /** Demande explicite de lier aux identités de tiers dont le LEI est identique (jamais sur simple nom). */
  linkCertain: z.boolean().optional(),
})

const asAliases = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/**
 * Import guidé de contrats TIC (CSV / XLSX) : `dryRun` = aperçu ligne à ligne sans écriture ; sinon création des lignes valides
 * (rôles habilités au registre TIC, module réglementaire actif). Une référence déjà présente n'est jamais écrasée.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const instanceRole = (session.user as { role?: UserRole }).role ?? 'ANALYSTE'
  const scope = await getAnalyseScope(userId, instanceRole)
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'organization_required' }, { status: 400 })
  if (!scope.role || !peutGererRegistreTic(scope.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!(await getOrgConfig(orgId)).reglementaireActive) return NextResponse.json({ error: 'module_inactive' }, { status: 403 })

  let body: z.infer<typeof schema>
  try { body = schema.parse(await req.json()) } catch { return NextResponse.json({ error: 'excel_file_invalid' }, { status: 400 }) }
  const buffer = Buffer.from(body.data, 'base64')
  const formatError = checkTabularUpload(body.filename, buffer.subarray(0, 16))
  if (formatError) return NextResponse.json({ error: formatError }, { status: importErrorStatus(formatError) })
  const rl = await rateLimit(`excel-parse:${userId}`, LIMIT_EXCEL_PARSE.limit, LIMIT_EXCEL_PARSE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'excel_rate_limited' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })

  let rows: TicContractRow[]; let columns: ReturnType<typeof mapTicContractColumns>; let sheetName: string
  try {
    const loaded = await loadTabularWorkbook(buffer, body.filename)
    if (!loaded.ok) return NextResponse.json({ error: loaded.error, details: loaded.details }, { status: loaded.status })
    const sheet = loaded.workbook.worksheets.find(ws => ws.rowCount > 0)
    if (!sheet) return NextResponse.json({ error: 'excel_no_importable_sheet' }, { status: 400 })
    sheetName = sheet.name
    const layout = detectHistoricHeaderLayout(readSheetSample(sheet, 20, 100))
    const headers = layout.columns.map(c => c.key)
    columns = mapTicContractColumns(headers)
    if (!columns.reference || !columns.prestataire) return NextResponse.json({ error: 'tic_columns_missing', headers }, { status: 400 })
    const data = readDataRows(sheet, layout, { max: MAX_TIC_ROWS })
    if (data.truncated) return NextResponse.json({ error: 'excel_too_many_rows', details: sheet.name }, { status: 413 })
    const cell = (row: Record<string, string>, header?: string) => (header ? (row[header] ?? '').trim() : '')
    rows = data.rows.flatMap((row, i) => {
      const v = {
        reference: cell(row, columns.reference), prestataire: cell(row, columns.prestataire), lei: cell(row, columns.lei), pays: cell(row, columns.pays),
        typeService: cell(row, columns.typeService), criticite: cell(row, columns.criticite), dateDebut: cell(row, columns.dateDebut), dateFin: cell(row, columns.dateFin), fonction: cell(row, columns.fonction),
      }
      if (!Object.values(v).some(Boolean)) return []
      return [{ line: data.rowNumbers[i], ...v }]
    })
  } catch { return NextResponse.json({ error: 'excel_workbook_unreadable' }, { status: 422 }) }

  const loadTiers = async (db: Pick<typeof prisma, 'tierOrganization'>): Promise<TierLite[]> =>
    (await db.tierOrganization.findMany({ where: { organizationId: orgId }, select: { tier: { select: { id: true, nom: true, lei: true, aliases: true } } } }))
      .map(g => ({ id: g.tier.id, nom: g.tier.nom, lei: g.tier.lei, aliases: asAliases(g.tier.aliases) }))

  if (body.dryRun) {
    const [existing, tiers] = await Promise.all([prisma.arrangementTic.findMany({ where: { organizationId: orgId }, select: { reference: true } }), loadTiers(prisma)])
    const plan = planTicContractImport(rows, existing, tiers)
    return NextResponse.json({ sheet: sheetName, columns, lines: plan.lines, counts: plan.counts })
  }

  try {
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${orgId}), hashtext('tic-contract-import'))::text`)
      const [existing, tiers] = await Promise.all([tx.arrangementTic.findMany({ where: { organizationId: orgId }, select: { reference: true } }), loadTiers(tx as unknown as typeof prisma)])
      const plan = planTicContractImport(rows, existing, tiers)
      let linked = 0
      for (const l of plan.toCreate) {
        const tierId = body.linkCertain && l.tier?.strength === 'STRONG' ? l.tier.tierId : null
        if (tierId) linked += 1
        await tx.arrangementTic.create({ data: {
          organizationId: orgId, reference: l.reference, prestataireNom: l.prestataire, identifiant: l.lei ?? null, pays: l.pays ?? null,
          typeService: l.typeService, criticite: l.criticite, fonctionSupportee: l.fonction ?? null,
          dateDebut: l.dateDebut ? new Date(`${l.dateDebut}T00:00:00.000Z`) : null, dateFin: l.dateFin ? new Date(`${l.dateFin}T00:00:00.000Z`) : null,
          ...(tierId ? { tierId } : {}),
        } })
      }
      return { plan, created: plan.toCreate.length, linked }
    })
    await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId, userRole: scope.role, organizationId: orgId, ip: getClientIp(req), details: { scope: 'registre-tic', action: 'import', file: body.filename.slice(0, 120), created: result.created, linked: result.linked, counts: result.plan.counts } })
    return NextResponse.json({ sheet: sheetName, columns, lines: result.plan.lines, counts: result.plan.counts, created: result.created, linked: result.linked }, { status: result.created ? 201 : 200 })
  } catch (error) {
    console.error('[registre-tic import]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'import_failed' }, { status: 500 })
  }
}
