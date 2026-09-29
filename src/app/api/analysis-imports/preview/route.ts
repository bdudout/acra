import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import ExcelJS from 'exceljs'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { canCreateAnalyse, type UserRole } from '@/lib/permissions'
import { getAnalyseScope, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { excelCellText } from '@/lib/excel-cell'
import { rateLimit, rateLimitHeaders, LIMIT_EXCEL_PARSE } from '@/lib/rate-limit'
import { checkXlsxArchive } from '@/lib/xlsx-guard'
import { detectContextSheet } from '@/lib/excel-blocks'
import { suggestAtelierMapping } from '@/lib/import-ateliers-build'
import { readSheetSample, sheetFormulaIssues, sheetUsedBounds } from '@/lib/excel-grid'
import { checkExcelUpload } from '@/lib/import-file-format'
import { importErrorStatus } from '@/lib/import-errors'
import { isAtelierRole, detectHistoricHeaderLayout, detectHistoricImportSheet, profileHistoricColumn, suggestHistoricColumnMapping, validateHistoricColumnMapping } from '@/lib/historic-import'

const schema = z.object({ filename: z.string().max(255), data: z.string().min(1).max(14_000_000), organizationId: z.string().trim().min(1).max(191).optional() })

/** Prévisualisation Excel sans persistance : première étape obligatoire de l'import historique. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const globalRole = ((session.user as { role?: UserRole }).role ?? 'LECTEUR') as UserRole
  const scope = await getAnalyseScope(userId, globalRole)
  let body: z.infer<typeof schema>
  try { body = schema.parse(await req.json()) } catch { return NextResponse.json({ error: 'excel_file_invalid' }, { status: 400 }) }
  const targetOrganizationId = body.organizationId ?? scope.activeOrgId
  const targetRole = targetOrganizationId ? await getEffectiveRoleForOrg(userId, globalRole, targetOrganizationId) : null
  if (!targetRole || !canCreateAnalyse({ id: userId, role: targetRole })) return NextResponse.json({ error: 'Droit de création d’analyse requis' }, { status: 403 })
  // Format vérifié sur le CONTENU (signature) et l'extension : un .xls — même renommé — reçoit un message dédié.
  const buffer = Buffer.from(body.data, 'base64')
  const formatError = checkExcelUpload(body.filename, buffer.subarray(0, 16))
  if (formatError) return NextResponse.json({ error: formatError }, { status: importErrorStatus(formatError) })
  // Débit + taille décompressée vérifiés AVANT tout chargement ExcelJS (qui
  // décompresse tout en mémoire et bloque l'event loop sur un gros classeur).
  const rl = await rateLimit(`excel-parse:${userId}`, LIMIT_EXCEL_PARSE.limit, LIMIT_EXCEL_PARSE.windowMs)
  if (!rl.allowed) return NextResponse.json({ error: 'excel_rate_limited' }, { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) })
  const archive = checkXlsxArchive(buffer)
  if (!archive.ok) return NextResponse.json({ error: archive.reason === 'NOT_ZIP' ? 'excel_workbook_unreadable' : 'excel_file_too_large' }, { status: archive.reason === 'NOT_ZIP' ? 422 : 413 })
  try {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as never)
    const sheets = workbook.worksheets.slice(0, 20).map(sheet => {
      // Échantillon d'en-tête : fusions lues une fois (titre / bandeau ≠ en-tête) ; zone utile et formules sans valeur signalées (lot I1).
      const layout = detectHistoricHeaderLayout(readSheetSample(sheet, 20, 100))
      const columns = layout.columns
      const header = columns.map(column => column.key)
      let detection = detectHistoricImportSheet(sheet.name, header)
      // Feuille sans tableau : périmètre en texte libre ou page de garde (rôle « contexte »).
      const contextKind = detection.type === 'UNKNOWN' ? detectContextSheet(sheet.name, readSheetSample(sheet, 80, 20)) : null
      if (contextKind) detection = { type: 'CONTEXT', confidence: 'MEDIUM', missing: [] }
      const mapping = isAtelierRole(detection.type) ? suggestAtelierMapping(detection.type, header) : suggestHistoricColumnMapping(header)
      const { lastRow } = sheetUsedBounds(sheet)
      const dataRowCount = contextKind ? Math.max(1, lastRow) : Math.max(0, lastRow - layout.headerRowIndex - 1)
      const dataRows = Array.from({ length: Math.min(500, dataRowCount) }, (_, offset) => sheet.getRow(layout.headerRowIndex + offset + 2))
      const profiles = Object.fromEntries(columns.map(column => [column.key, profileHistoricColumn(dataRows.map(row => {
        const value = row.getCell(column.index + 1).value
        return excelCellText(value)
      }))]))
      const issues = sheetFormulaIssues(sheet)
      return { name: sheet.name, columns: header, profiles, rows: dataRowCount, headerRow: layout.headerRowIndex + 1, detection, mapping, missing: validateHistoricColumnMapping(detection.type, mapping), warnings: { formulasWithoutValue: issues.withoutValue, formulaErrors: issues.errors } }
    })
    return NextResponse.json({ filename: body.filename, sheets })
  } catch { return NextResponse.json({ error: 'excel_workbook_unreadable' }, { status: 422 }) }
}
