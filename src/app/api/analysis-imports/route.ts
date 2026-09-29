import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import ExcelJS from 'exceljs'
import { z } from 'zod'
import { HISTORIC_SHEET_TYPES, splitHistoricMappedColumns } from '@/lib/historic-import'
import { authOptions } from '@/lib/auth'
import { canCreateAnalyse, type UserRole } from '@/lib/permissions'
import { getAnalyseScope, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { applyHistoricRowOverrides, buildHistoricImportPackages, detectHistoricHeaderLayout, detectHistoricImportSheet, partitionHistoricImportSheets, profileHistoricColumn, resolveHistoricImportSheetType, type HistoricColumnMapping, type HistoricFieldTransforms, type HistoricRowOverrides, validateHistoricColumnMapping, validateHistoricImportFormats, validateHistoricImportSelection } from '@/lib/historic-import'
import { executeAnalysisImport, parseAnalysisImportRequest } from '@/lib/analysis-import'
import { buildHistoricExcelIdempotencyKey } from '@/lib/historic-import-idempotency'
import { excelCellText as cell } from '@/lib/excel-cell'
import { rateLimit, rateLimitHeaders, LIMIT_EXCEL_PARSE } from '@/lib/rate-limit'
import { checkXlsxArchive } from '@/lib/xlsx-guard'
import { readSheetSample, readDataRows } from '@/lib/excel-grid'
import { checkExcelUpload } from '@/lib/import-file-format'
import { importErrorStatus } from '@/lib/import-errors'

const sheetType = z.enum(HISTORIC_SHEET_TYPES)
const valueTransform = z.object({ mode: z.enum(['LINES', 'SEMICOLON', 'PIPE']).optional(), carryForward: z.boolean().optional() }).refine(value => Boolean(value.mode || value.carryForward))
const rowOverrides = z.record(z.string(), z.record(z.string(), z.record(z.string(), z.string().trim().max(10_000)))).default({})
const schema = z.object({ filename: z.string().max(255), data: z.string().min(1).max(14_000_000), organizationId: z.string().trim().min(1).max(191).optional(), mappings: z.record(z.string(), z.record(z.string(), z.string().optional())), sheetTypes: z.record(z.string(), sheetType).default({}), transforms: z.record(z.string(), z.record(z.string(), valueTransform.optional())).default({}), statusMappings: z.record(z.string(), z.record(z.string(), z.enum(['A_FAIRE', 'EN_COURS', 'REALISE', 'REPORTE']))).default({}), scoreMappings: z.record(z.string(), z.record(z.string(), z.record(z.string(), z.enum(['1', '2', '3', '4'])))).default({}), partialImport: z.boolean().default(true), dryRun: z.boolean().default(false), rowOverrides })

/** Exécute un import Excel après la prévisualisation et le mapping humain obligatoire. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const role = ((session.user as { role?: UserRole }).role ?? 'LECTEUR') as UserRole
  const scope = await getAnalyseScope(userId, role)
  try {
    const body = schema.parse(await req.json())
    const organizationId = body.organizationId ?? scope.activeOrgId
    const targetRole = organizationId ? await getEffectiveRoleForOrg(userId, role, organizationId) : null
    if (!organizationId || !targetRole || !canCreateAnalyse({ id: userId, role: targetRole })) return NextResponse.json({ error: 'Droit de création d’analyse requis' }, { status: 403 })
    // Débit + taille décompressée vérifiés AVANT tout chargement ExcelJS (qui
    // décompresse tout en mémoire et bloque l'event loop sur un gros classeur).
    const rl = await rateLimit(`excel-parse:${userId}`, LIMIT_EXCEL_PARSE.limit, LIMIT_EXCEL_PARSE.windowMs)
    if (!rl.allowed) return NextResponse.json({ error: 'excel_rate_limited' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
    const buffer = Buffer.from(body.data, 'base64')
    const formatError = checkExcelUpload(body.filename, buffer.subarray(0, 16))
    if (formatError) return NextResponse.json({ error: formatError }, { status: importErrorStatus(formatError) })
    const archive = checkXlsxArchive(buffer)
    if (!archive.ok) return NextResponse.json({ error: archive.reason === 'NOT_ZIP' ? 'excel_workbook_unreadable' : 'excel_file_too_large' }, { status: archive.reason === 'NOT_ZIP' ? 422 : 413 })
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer as never)
    const sheets = workbook.worksheets.slice(0, 20).map(sheet => {
      const layout = detectHistoricHeaderLayout(readSheetSample(sheet, 20, 100)) // même lecture que l'aperçu
      const headers = layout.columns.map(column => column.key)
      const detection = detectHistoricImportSheet(sheet.name, headers)
      const type = resolveHistoricImportSheetType(detection.type, body.sheetTypes[sheet.name])
      const mapping = (body.mappings[sheet.name] ?? {}) as HistoricColumnMapping
      if (type !== 'UNKNOWN' && validateHistoricColumnMapping(type, mapping).length) throw new Error(`MAPPING_INCOMPLET:${sheet.name}`)
      // Colonne de référence du rôle : une ligne dont la référence est une cellule fusionnée esclave prolonge la précédente.
      const refColumn = splitHistoricMappedColumns(mapping.externalId)[0]
      const refIndex = layout.columns.find(column => column.key === refColumn)?.index
      const { rows, rowNumbers } = readDataRows(sheet, layout, { refColumnIndex: refIndex })
      const profiles = Object.fromEntries(headers.map(header => [header, profileHistoricColumn(rows.map(row => row[header] ?? ''))]))
      return { name: sheet.name, type, mapping, transforms: body.transforms[sheet.name] as HistoricFieldTransforms | undefined, statusMapping: body.statusMappings[sheet.name], scoreMappings: body.scoreMappings[sheet.name], rows, rowNumbers, profiles }
    })
    const correctedSheets = applyHistoricRowOverrides(sheets, body.rowOverrides as HistoricRowOverrides)
    if (validateHistoricImportSelection(sheets).length || (!body.partialImport && validateHistoricImportFormats(sheets).length)) throw new Error('MAPPING_INCOMPLET:cross_sheet_reference_or_format')
    const partition = body.partialImport ? partitionHistoricImportSheets(correctedSheets) : { sheets: correctedSheets, decisions: [] }
    if (body.dryRun) return NextResponse.json({ decisions: partition.decisions, requiredValueGaps: partition.decisions.filter(decision => decision.status === 'REJECTED' && decision.reason === 'MISSING_REQUIRED_VALUE') })
    if (!partition.sheets.some(sheet => sheet.type !== 'UNKNOWN' && sheet.rows.length > 0)) throw new Error('NO_IMPORTABLE_SHEET')
    const fallback = body.filename.replace(/\.xlsx$/i, '')
    const packageData = buildHistoricImportPackages(partition.sheets, fallback)
    const key = buildHistoricExcelIdempotencyKey(body.data, { organizationId, mappings: body.mappings, sheetTypes: body.sheetTypes, transforms: body.transforms, statusMappings: body.statusMappings, scoreMappings: body.scoreMappings, partialImport: body.partialImport, rowOverrides: body.rowOverrides })
    const results = await Promise.all(packageData.map((item, index) => executeAnalysisImport(parseAnalysisImportRequest({ ...item, idempotencyKey: `${key}:${index}` }), { organizationId, userId, source: 'EXCEL_WEB' })))
    return NextResponse.json({ results, decisions: partition.decisions, imported: results.length, ...results[0] }, { status: results.every(result => result.replayed) ? 200 : 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import Excel invalide'
    const errorCode = message.startsWith('MAPPING_INCOMPLET') ? 'excel_mapping_incomplete'
      : message === 'NO_IMPORTABLE_SHEET' ? 'excel_no_importable_sheet'
        : message.startsWith('duplicate_external_id:') ? 'excel_duplicate_reference'
          : 'excel_import_invalid'
    // Détail utile à l'utilisateur pour les erreurs codées par l'application et la
    // validation ; jamais le message brut d'une erreur interne (noms de tables…).
    const details = errorCode !== 'excel_import_invalid' ? message
      : error instanceof z.ZodError ? error.issues.slice(0, 5).map(issue => `${issue.path.join('.')}: ${issue.message}`).join(' ; ')
        : undefined
    return NextResponse.json({ error: errorCode, details }, { status: errorCode === 'excel_mapping_incomplete' || errorCode === 'excel_no_importable_sheet' ? 400 : 422 })
  }
}
