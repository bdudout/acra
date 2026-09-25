import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import ExcelJS from 'exceljs'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { canCreateAnalyse, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { detectHistoricImportSheet, suggestHistoricColumnMapping, validateHistoricColumnMapping } from '@/lib/historic-import'

const schema = z.object({ filename: z.string().max(255), data: z.string().min(1).max(14_000_000) })

/** Prévisualisation Excel sans persistance : première étape obligatoire de l'import historique. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const globalRole = ((session.user as { role?: UserRole }).role ?? 'LECTEUR') as UserRole
  const scope = await getAnalyseScope(userId, globalRole)
  if (!scope.activeOrgId || !canCreateAnalyse({ id: userId, role: scope.role })) {
    return NextResponse.json({ error: 'Droit de création d’analyse requis' }, { status: 403 })
  }
  let body: z.infer<typeof schema>
  try { body = schema.parse(await req.json()) } catch { return NextResponse.json({ error: 'Fichier invalide ou trop volumineux' }, { status: 400 }) }
  if (!/\.xlsx$/i.test(body.filename)) return NextResponse.json({ error: 'Seul le format .xlsx est accepté pour la prévisualisation' }, { status: 400 })
  try {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(Buffer.from(body.data, 'base64') as never)
    const sheets = workbook.worksheets.slice(0, 20).map(sheet => {
      const rowValues = sheet.getRow(1).values
      const values = Array.isArray(rowValues) ? rowValues.slice(1, 101) : []
      const header = values
        .map((value: unknown) => typeof value === 'object' && value !== null && 'text' in value ? String(value.text) : String(value ?? '').trim())
        .filter(Boolean)
      const detection = detectHistoricImportSheet(sheet.name, header)
      const mapping = suggestHistoricColumnMapping(header)
      return { name: sheet.name, columns: header, rows: Math.max(0, sheet.rowCount - 1), detection, mapping, missing: validateHistoricColumnMapping(detection.type, mapping) }
    })
    return NextResponse.json({ filename: body.filename, sheets })
  } catch { return NextResponse.json({ error: 'Classeur Excel illisible' }, { status: 422 }) }
}
