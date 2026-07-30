import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { perteNette, delaiDetection } from '@/lib/incident'
import { resolveTaxonomie, taxonomieLabel } from '@/lib/taxonomie'
import { getT } from '@/lib/i18n'
import { toCsvCell, sanitizeForSpreadsheet } from '@/lib/spreadsheet-safe'
import { auditLog, getClientIp } from '@/lib/logger'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

// Colonnes de la LDC (Loss Data Collection, Bâle) : un incident par ligne, avec
// la maille, la chronologie et le triptyque brut / récupérations / net.
const HEADERS = [
  'reference', 'intitule', 'categorie', 'processus', 'entite',
  'dateSurvenance', 'dateDetection', 'delaiDetectionJours',
  'impactEstime', 'montantBrut', 'recuperations', 'perteNette',
  'statut', 'risqueLie', 'declareLe', 'qualifieLe', 'clotureLe',
]

// GET /api/incidents/export?format=csv|xlsx&lang=fr — export LDC de l'org active.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, userRole)
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  const orgConfig = await getOrgConfig(orgId)
  if (!orgConfig.incidentsActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const format = (searchParams.get('format') ?? 'csv').toLowerCase()
  if (!['csv', 'xlsx'].includes(format)) {
    return NextResponse.json({ error: 'Format non supporté' }, { status: 400 })
  }
  // Filtre optionnel : ne retenir que les incidents survenus depuis `from`.
  const from = searchParams.get('from')
  const depuis = from ? new Date(from) : null
  const bornee = depuis && !Number.isNaN(depuis.getTime()) ? depuis : null

  const langParam = searchParams.get('lang')
  const locale = ['fr', 'en', 'de', 'es', 'it'].includes(langParam ?? '') ? (langParam as string) : 'fr'
  const t = getT(locale)
  const tr = (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], t) as string ?? ''
  const taxonomie = resolveTaxonomie(orgConfig.taxonomieRisques)
  const catLabel = (code: string | null): string => {
    if (!code) return ''
    const node = taxonomie.find(n => n.code === code)
    return node ? taxonomieLabel(node, tr) : code
  }

  const rows = await prisma.incident.findMany({
    where: { organizationId: orgId, ...(bornee ? { dateSurvenance: { gte: bornee } } : {}) },
    orderBy: [{ dateSurvenance: 'desc' }, { createdAt: 'desc' }],
    include: { processus: { select: { nom: true } }, riskItem: { select: { intitule: true } } },
  })

  const num = (v: unknown): number | null => (v == null ? null : Number(v as unknown as string))
  const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')

  const lignes = rows.map(r => {
    const brut = num(r.montantBrut)
    const recup = num(r.recuperations)
    return {
      reference: r.id,
      intitule: r.intitule,
      categorie: catLabel(r.taxonomieCode),
      processus: r.processus?.nom ?? '',
      entite: r.entite ?? '',
      dateSurvenance: jour(r.dateSurvenance),
      dateDetection: jour(r.dateDetection),
      delaiDetectionJours: delaiDetection(r.dateSurvenance, r.dateDetection) ?? '',
      impactEstime: r.impactEstime ?? '',
      montantBrut: brut ?? '',
      recuperations: recup ?? '',
      perteNette: perteNette(brut, recup) ?? '',
      statut: r.statut,
      risqueLie: r.riskItem?.intitule ?? '',
      declareLe: jour(r.createdAt),
      qualifieLe: jour(r.qualifieLe),
      clotureLe: jour(r.clotureLe),
    }
  })

  const now = new Date()
  const stamp = now.toISOString().slice(0, 10)
  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'incident', action: 'export-ldc', format, lignes: lignes.length },
  })

  if (format === 'xlsx') {
    const S = sanitizeForSpreadsheet
    const wb = new ExcelJS.Workbook()
    wb.creator = 'ACRA — Augmented Cyber Risk Analysis'
    wb.created = now
    const ws = wb.addWorksheet('LDC')
    ws.columns = HEADERS.map(h => ({ header: h, key: h, width: h === 'intitule' ? 40 : 16 }))
    for (const l of lignes) {
      ws.addRow({
        ...l,
        intitule: S(l.intitule), categorie: S(l.categorie), processus: S(l.processus),
        entite: S(l.entite), risqueLie: S(l.risqueLie), reference: S(l.reference),
      })
    }
    ws.getRow(1).eachCell((c: ExcelJS.Cell) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } }
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    })
    ws.getRow(1).height = 20
    // Totaux LDC en pied de tableau (brut / récupérations / net).
    const totalBrut = lignes.reduce((s, l) => s + (typeof l.montantBrut === 'number' ? l.montantBrut : 0), 0)
    const totalRecup = lignes.reduce((s, l) => s + (typeof l.recuperations === 'number' ? l.recuperations : 0), 0)
    const totalNet = lignes.reduce((s, l) => s + (typeof l.perteNette === 'number' ? l.perteNette : 0), 0)
    ws.addRow({})
    ws.addRow({ intitule: 'TOTAL', montantBrut: totalBrut, recuperations: totalRecup, perteNette: totalNet })

    const buf = await wb.xlsx.writeBuffer()
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="acra-ldc-${stamp}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  const csv = '﻿' + [
    HEADERS.join(','),
    ...lignes.map(l => HEADERS.map(h => toCsvCell((l as Record<string, unknown>)[h])).join(',')),
  ].join('\r\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="acra-ldc-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
