import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import ExcelJS from 'exceljs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import type { UserRole } from '@/lib/permissions'
import { peutLireRapports } from '@/lib/rapport-acces'
import type { RapportContenu } from '@/lib/rapport-model'
import { contenuVersFeuilles } from '@/lib/rapport-render'
import { getT } from '@/lib/i18n'
import { sanitizeForSpreadsheet } from '@/lib/spreadsheet-safe'
import { auditLog, getClientIp } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET /api/rapports/[id]/export?lang=fr — export Excel d'une édition (une feuille par section).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  if (!scope.activeOrgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  const role = scope.role as UserRole
  if (!peutLireRapports(role)) return NextResponse.json({ error: 'Rôle non autorisé' }, { status: 403 })
  const { id } = await params
  const edition = await prisma.rapportEdition.findFirst({ where: { id, organizationId: scope.activeOrgId } })
  if (!edition) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const langParam = new URL(req.url).searchParams.get('lang')
  const locale = ['fr', 'en', 'de', 'es', 'it'].includes(langParam ?? '') ? (langParam as string) : edition.langue
  const t = getT(locale)
  const tr = (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], t) as string | undefined
  const contenu = edition.contenu as unknown as RapportContenu

  const wb = new ExcelJS.Workbook()
  wb.creator = 'ACRA — Augmented Cyber Risk Analysis'
  wb.created = new Date()
  const noms = new Set<string>()
  for (const f of contenuVersFeuilles(contenu, tr, locale)) {
    let nom = f.nom.replace(/[\\/?*[\]:]/g, ' ') || 'Feuille'
    while (noms.has(nom)) nom = `${nom.slice(0, 28)}_2`
    noms.add(nom)
    const ws = wb.addWorksheet(nom)
    for (const l of f.lignes) ws.addRow(l.map(v => (typeof v === 'string' ? sanitizeForSpreadsheet(v) : v)))
    ws.columns.forEach(c => { c.width = 28 })
  }
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole: role, organizationId: scope.activeOrgId, ip: getClientIp(req),
    details: { scope: 'rapport', action: 'export', id, code: edition.code },
  })
  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="acra-${edition.code}-${edition.periodeDebut.toISOString().slice(0, 10)}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
