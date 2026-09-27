import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import ExcelJS from 'exceljs'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { canCreateAnalyse, type UserRole } from '@/lib/permissions'
import { getAnalyseScope, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { detectHistoricHeaderLayout, detectHistoricImportSheet, profileHistoricColumn, suggestHistoricColumnMapping, validateHistoricColumnMapping } from '@/lib/historic-import'

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
  if (!/\.xlsx$/i.test(body.filename)) return NextResponse.json({ error: 'excel_file_type_invalid' }, { status: 400 })
  try {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(Buffer.from(body.data, 'base64') as never)
    const sheets = workbook.worksheets.slice(0, 20).map(sheet => {
      const sampleRows = Array.from({ length: Math.min(20, sheet.rowCount) }, (_, offset) => Array.from({ length: 100 }, (_, index) => {
        const value = sheet.getRow(offset + 1).getCell(index + 1).value
        return value instanceof Date ? value.toISOString().slice(0, 10) : typeof value === 'object' && value !== null && 'text' in value ? String(value.text) : String(value ?? '').trim()
      }))
      const layout = detectHistoricHeaderLayout(sampleRows)
      const columns = layout.columns
      const header = columns.map(column => column.key)
      const detection = detectHistoricImportSheet(sheet.name, header)
      const mapping = suggestHistoricColumnMapping(header)
      const dataRows = Array.from({ length: Math.min(500, Math.max(0, sheet.rowCount - layout.headerRowIndex - 1)) }, (_, offset) => sheet.getRow(layout.headerRowIndex + offset + 2))
      const profiles = Object.fromEntries(columns.map(column => [column.key, profileHistoricColumn(dataRows.map(row => {
        const value = row.getCell(column.index + 1).value
        return value instanceof Date ? value.toISOString().slice(0, 10) : typeof value === 'object' && value !== null && 'text' in value ? String(value.text) : String(value ?? '').trim()
      }))]))
      return { name: sheet.name, columns: header, profiles, rows: Math.max(0, sheet.rowCount - layout.headerRowIndex - 1), headerRow: layout.headerRowIndex + 1, detection, mapping, missing: validateHistoricColumnMapping(detection.type, mapping) }
    })
    return NextResponse.json({ filename: body.filename, sheets })
  } catch { return NextResponse.json({ error: 'excel_workbook_unreadable' }, { status: 422 }) }
}
