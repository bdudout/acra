import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { peutGererRegistreTic } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_EXCEL_PARSE } from '@/lib/rate-limit'
import { checkTabularUpload } from '@/lib/import-file-format'
import { importErrorStatus } from '@/lib/import-errors'
import { loadTabularWorkbook } from '@/lib/tabular-workbook'
import { detectHistoricHeaderLayout } from '@/lib/historic-import'
import { readDataRows, readSheetSample } from '@/lib/excel-grid'
import { mapUsageImportColumns, planUsageImport, MAX_USAGE_IMPORT_ROWS, type LigneUsageImport, type UsageCible } from '@/lib/tier-usage-import'
import { MAX_POINTS_PAR_USAGE } from '@/lib/tier-endpoints'

export const dynamic = 'force-dynamic'

const schema = z.object({ filename: z.string().max(255), data: z.string().min(1).max(14_000_000), dryRun: z.boolean().optional() })
const asAliases = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/**
 * Import (CSV / XLSX) des points d'accès et de la qualification (PCI, SI, exposition, interconnexion) des usages TIC
 * EXISTANTS de l'organisation active : `dryRun` = aperçu ligne à ligne sans écriture. Ne crée ni tiers, ni offre, ni usage.
 */
export const POST = withAccess({ org: 'active', allow: peutGererRegistreTic }, async (req, { user, role, orgId }) => {
  if (!(await getOrgConfig(orgId)).reglementaireActive) return NextResponse.json({ error: 'module_inactive' }, { status: 403 })
  let body: z.infer<typeof schema>
  try { body = schema.parse(await req.json()) } catch { return NextResponse.json({ error: 'excel_file_invalid' }, { status: 400 }) }
  const buffer = Buffer.from(body.data, 'base64')
  const formatError = checkTabularUpload(body.filename, buffer.subarray(0, 16))
  if (formatError) return NextResponse.json({ error: formatError }, { status: importErrorStatus(formatError) })
  const rl = await rateLimit(`excel-parse:${user.id}`, LIMIT_EXCEL_PARSE.limit, LIMIT_EXCEL_PARSE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'excel_rate_limited' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })

  let lignes: LigneUsageImport[]; let columns: ReturnType<typeof mapUsageImportColumns>; let sheetName: string
  try {
    const loaded = await loadTabularWorkbook(buffer, body.filename)
    if (!loaded.ok) return NextResponse.json({ error: loaded.error, details: loaded.details }, { status: loaded.status })
    const sheet = loaded.workbook.worksheets.find(ws => ws.rowCount > 0)
    if (!sheet) return NextResponse.json({ error: 'excel_no_importable_sheet' }, { status: 400 })
    sheetName = sheet.name
    const layout = detectHistoricHeaderLayout(readSheetSample(sheet, 20, 100))
    const headers = layout.columns.map(c => c.key)
    columns = mapUsageImportColumns(headers)
    if (!columns.tiers || !columns.offre) return NextResponse.json({ error: 'usage_import_columns_missing', headers }, { status: 400 })
    const data = readDataRows(sheet, layout, { max: MAX_USAGE_IMPORT_ROWS })
    if (data.truncated) return NextResponse.json({ error: 'excel_too_many_rows', details: sheet.name }, { status: 413 })
    const cell = (row: Record<string, string>, h?: string) => (h ? (row[h] ?? '').trim() : '')
    lignes = data.rows.flatMap((row, i) => {
      const v = {
        tiers: cell(row, columns.tiers), offre: cell(row, columns.offre), usage: cell(row, columns.usage), adresse: cell(row, columns.adresse), type: cell(row, columns.type),
        environnement: cell(row, columns.environnement), authentification: cell(row, columns.authentification), pci: cell(row, columns.pci), si: cell(row, columns.si),
        exposition: cell(row, columns.exposition), interconnexion: cell(row, columns.interconnexion),
      }
      return Object.values(v).some(Boolean) ? [{ line: data.rowNumbers[i], ...v }] : []
    })
  } catch { return NextResponse.json({ error: 'excel_workbook_unreadable' }, { status: 422 }) }

  const chargerUsages = async (db: Pick<typeof prisma, 'tierServiceUsage'>): Promise<UsageCible[]> =>
    (await db.tierServiceUsage.findMany({
      where: { organizationId: orgId },
      select: { id: true, useCase: true, pointsAcces: { select: { adresse: true } }, tierService: { select: { nom: true, tier: { select: { nom: true, aliases: true } } } } },
    })).map(u => ({ id: u.id, tiers: u.tierService.tier.nom, aliases: asAliases(u.tierService.tier.aliases), offre: u.tierService.nom, usage: u.useCase, adresses: u.pointsAcces.map(p => p.adresse) }))

  if (body.dryRun) {
    const plan = planUsageImport(lignes, await chargerUsages(prisma))
    return NextResponse.json({ sheet: sheetName, columns, lines: plan.lines, counts: plan.counts })
  }
  try {
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${orgId}), hashtext('tier-usage-import'))::text`)
      const plan = planUsageImport(lignes, await chargerUsages(tx as unknown as typeof prisma))
      let points = 0, qualifications = 0, plafond = 0
      for (const l of plan.lignesValides) {
        if (Object.keys(l.qualification).length) { await tx.tierServiceUsage.update({ where: { id: l.usageId }, data: l.qualification }); qualifications += 1 }
        if (l.point) {
          if (await tx.tierUsageEndpoint.count({ where: { usageId: l.usageId } }) >= MAX_POINTS_PAR_USAGE) { plafond += 1; continue }
          await tx.tierUsageEndpoint.create({ data: { usageId: l.usageId, organizationId: orgId, ...l.point } }); points += 1
        }
      }
      return { plan, points, qualifications, plafond }
    })
    await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId: user.id, userRole: role, organizationId: orgId, ip: getClientIp(req), details: { scope: 'tier-registry', action: 'usage-import', file: body.filename.slice(0, 120), points: result.points, qualifications: result.qualifications, plafond: result.plafond, counts: result.plan.counts } })
    return NextResponse.json({ sheet: sheetName, columns, lines: result.plan.lines, counts: result.plan.counts, points: result.points, qualifications: result.qualifications, plafond: result.plafond }, { status: result.points || result.qualifications ? 201 : 200 })
  } catch (error) {
    console.error('[tier-usage import]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'import_failed' }, { status: 500 })
  }
})
