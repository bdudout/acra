import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import ExcelJS from 'exceljs'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { canCreateAnalyse, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { buildHistoricImportPackages, detectHistoricImportSheet, type HistoricColumnMapping, validateHistoricColumnMapping } from '@/lib/historic-import'
import { executeAnalysisImport, parseAnalysisImportRequest } from '@/lib/analysis-import'

const schema = z.object({ filename: z.string().max(255).regex(/\.xlsx$/i), data: z.string().min(1).max(14_000_000), mappings: z.record(z.string(), z.record(z.string(), z.string().optional())) })
const cell = (value: unknown) => typeof value === 'object' && value !== null && 'text' in value ? String(value.text) : String(value ?? '').trim()

/** Exécute un import Excel après la prévisualisation et le mapping humain obligatoire. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const role = ((session.user as { role?: UserRole }).role ?? 'LECTEUR') as UserRole
  const scope = await getAnalyseScope(userId, role)
  if (!scope.activeOrgId || !canCreateAnalyse({ id: userId, role: scope.role })) return NextResponse.json({ error: 'Droit de création d’analyse requis' }, { status: 403 })
  const organizationId = scope.activeOrgId
  try {
    const body = schema.parse(await req.json())
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(body.data, 'base64') as never)
    const sheets = workbook.worksheets.slice(0, 20).map(sheet => {
      const headerValues = sheet.getRow(1).values
      const headers: string[] = (Array.isArray(headerValues) ? headerValues.slice(1, 101) : []).map(cell).filter(Boolean)
      const detection = detectHistoricImportSheet(sheet.name, headers)
      const mapping = (body.mappings[sheet.name] ?? {}) as HistoricColumnMapping
      if (detection.type !== 'UNKNOWN' && validateHistoricColumnMapping(detection.type, mapping).length) throw new Error('MAPPING_INCOMPLET')
      const rows = Array.from({ length: Math.min(500, Math.max(0, sheet.rowCount - 1)) }, (_, offset) => {
        const row = sheet.getRow(offset + 2)
        return Object.fromEntries(headers.map((header: string, index: number) => [header, cell(row.getCell(index + 1).value)]))
      })
      return { type: detection.type, mapping, rows }
    })
    const fallback = body.filename.replace(/\.xlsx$/i, '')
    const packageData = buildHistoricImportPackages(sheets, fallback)
    const key = `excel:${createHash('sha256').update(body.data).update(JSON.stringify(body.mappings)).digest('hex')}`
    const results = await Promise.all(packageData.map((item, index) => executeAnalysisImport(parseAnalysisImportRequest({ ...item, idempotencyKey: `${key}:${index}` }), { organizationId, userId, source: 'EXCEL_WEB' })))
    return NextResponse.json({ results, imported: results.length, ...results[0] }, { status: results.every(result => result.replayed) ? 200 : 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import Excel invalide'
    return NextResponse.json({ error: message === 'MAPPING_INCOMPLET' ? message : 'Import Excel invalide' }, { status: message === 'MAPPING_INCOMPLET' ? 400 : 422 })
  }
}
