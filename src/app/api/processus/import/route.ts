import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getOrgConfig } from '@/lib/org-config.server'
import { isAdminRole } from '@/lib/permissions'
import { withAccess } from '@/lib/with-access.server'
import { auditLog, getClientIp } from '@/lib/logger'
import { rateLimit, rateLimitHeaders, LIMIT_EXCEL_PARSE } from '@/lib/rate-limit'
import { checkTabularUpload } from '@/lib/import-file-format'
import { importErrorStatus } from '@/lib/import-errors'
import { loadTabularWorkbook } from '@/lib/tabular-workbook'
import { detectHistoricHeaderLayout } from '@/lib/historic-import'
import { readDataRows, readSheetSample } from '@/lib/excel-grid'
import { mapProcessusColumns, planProcessusImport, MAX_PROCESS_ROWS, type ProcessusImportRow, type ExistingProcessus } from '@/lib/processus-import'

export const dynamic = 'force-dynamic'

const schema = z.object({
  filename: z.string().max(255), data: z.string().min(1).max(14_000_000),
  dryRun: z.boolean().optional(),
  /** Numéros de ligne du fichier (ligne Excel/CSV) dont l'utilisateur confirme la création malgré un doublon possible. */
  createAnyway: z.array(z.number().int().positive()).max(MAX_PROCESS_ROWS).optional(),
})

const toExisting = (rows: { id: string; nom: string; parentId: string | null; catalogueKey: string | null }[]): ExistingProcessus[] =>
  rows.map(r => ({ id: r.id, nom: r.nom, parentId: r.parentId, importKey: r.catalogueKey?.startsWith('import:') ? r.catalogueKey : null }))

/**
 * Import guidé de processus (CSV / XLSX) : `dryRun` = aperçu ligne à ligne sans écriture ; sinon création des lignes valides
 * (ADMIN, module registre actif), parents avant enfants, provenance stable (référence du fichier), transaction verrouillée.
 */
// Le rate limit `excel-parse` (LIMIT_EXCEL_PARSE) reste dans le handler : il s'applique après le contrôle
// de format et renvoie le code `excel_rate_limited` que l'interface (ProcessusImportPanel) traduit.
export const POST = withAccess({ org: 'active', allow: isAdminRole }, async (req, { user, role, orgId }) => {
  const userId = user.id
  if (!(await getOrgConfig(orgId)).registreRisquesActive) return NextResponse.json({ error: 'module_inactive' }, { status: 403 })

  let body: z.infer<typeof schema>
  try { body = schema.parse(await req.json()) } catch { return NextResponse.json({ error: 'excel_file_invalid' }, { status: 400 }) }
  const buffer = Buffer.from(body.data, 'base64')
  const formatError = checkTabularUpload(body.filename, buffer.subarray(0, 16))
  if (formatError) return NextResponse.json({ error: formatError }, { status: importErrorStatus(formatError) })
  const rl = await rateLimit(`excel-parse:${userId}`, LIMIT_EXCEL_PARSE.limit, LIMIT_EXCEL_PARSE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'excel_rate_limited' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })

  // ── Lecture du fichier : première feuille utile ─────────────────────────────
  let rows: ProcessusImportRow[]; let columns: ReturnType<typeof mapProcessusColumns>; let sheetName: string
  try {
    const loaded = await loadTabularWorkbook(buffer, body.filename)
    if (!loaded.ok) return NextResponse.json({ error: loaded.error, details: loaded.details }, { status: loaded.status })
    const sheet = loaded.workbook.worksheets.find(ws => ws.rowCount > 0)
    if (!sheet) return NextResponse.json({ error: 'excel_no_importable_sheet' }, { status: 400 })
    sheetName = sheet.name
    const layout = detectHistoricHeaderLayout(readSheetSample(sheet, 20, 100))
    const headers = layout.columns.map(c => c.key)
    columns = mapProcessusColumns(headers)
    if (!columns.nom) return NextResponse.json({ error: 'name_column_missing', headers }, { status: 400 })
    const data = readDataRows(sheet, layout, { max: MAX_PROCESS_ROWS })
    if (data.truncated) return NextResponse.json({ error: 'excel_too_many_rows', details: sheet.name }, { status: 413 })
    const cell = (row: Record<string, string>, header?: string) => (header ? (row[header] ?? '').trim() : '')
    rows = data.rows.flatMap((row, i) => {
      const values = { nom: cell(row, columns.nom), ref: cell(row, columns.ref), parent: cell(row, columns.parent), description: cell(row, columns.description), proprietaire: cell(row, columns.proprietaire) }
      if (!Object.values(values).some(Boolean)) return [] // ligne entièrement vide : ignorée sans bruit
      return [{ line: data.rowNumbers[i], nom: values.nom, ref: values.ref || undefined, parent: values.parent || undefined, description: values.description || undefined, proprietaire: values.proprietaire || undefined }]
    })
  } catch { return NextResponse.json({ error: 'excel_workbook_unreadable' }, { status: 422 }) }

  const select = { id: true, nom: true, parentId: true, catalogueKey: true } as const
  if (body.dryRun) {
    const existing = toExisting(await prisma.processus.findMany({ where: { organizationId: orgId }, select }))
    const plan = planProcessusImport(rows, existing, { createAnyway: body.createAnyway })
    return NextResponse.json({ sheet: sheetName, columns, lines: plan.lines, counts: plan.counts })
  }

  // ── Écriture : transaction verrouillée par organisation, plan recalculé sur l'état courant ──
  try {
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${orgId}), hashtext('processus-import'))::text`)
      const existing = toExisting(await tx.processus.findMany({ where: { organizationId: orgId }, select }))
      const plan = planProcessusImport(rows, existing, { createAnyway: body.createAnyway })
      const ids = new Map<number, string>()
      for (const line of plan.toCreate) {
        const created = await tx.processus.create({ data: {
          organizationId: orgId, nom: line.nom, description: line.description?.slice(0, 2000) ?? null, proprietaire: line.proprietaire?.slice(0, 200) ?? null,
          parentId: line.parentLine !== undefined ? ids.get(line.parentLine) ?? null : line.parentExistingId ?? null,
          catalogueKey: line.key ?? null,
        } })
        ids.set(line.line, created.id)
      }
      return { plan, created: plan.toCreate.length }
    })
    await auditLog('ORGANIZATION_CONFIG_UPDATED', { userId, userRole: role, organizationId: orgId, ip: getClientIp(req), details: { scope: 'processus', action: 'import', file: body.filename.slice(0, 120), created: result.created, counts: result.plan.counts } })
    return NextResponse.json({ sheet: sheetName, columns, lines: result.plan.lines, counts: result.plan.counts, created: result.created }, { status: result.created ? 201 : 200 })
  } catch (error) {
    // Course sur la clé d'origine (deux imports simultanés) : l'unicité en base protège, l'utilisateur relance.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'concurrent_import' }, { status: 409 })
    console.error('[processus import]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'import_failed' }, { status: 500 })
  }
})
