import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import { type UserRole } from '@/lib/permissions'
import { niveauRisque } from '@/lib/risk-item'
import { summarizeActions } from '@/lib/risk-action'
import { applyFilters, parseFilters } from '@/lib/risk-filters'
import { buildCartoExport, type CartoExportRisk } from '@/lib/carto-export'
import { resolveTaxonomie, taxonomieLabel } from '@/lib/taxonomie'
import { getT } from '@/lib/i18n'
import { toCsvCell, sanitizeForSpreadsheet } from '@/lib/spreadsheet-safe'
import { auditLog, getClientIp } from '@/lib/logger'
import { createRequire } from 'node:module'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

const HEADERS = [
  'intitule', 'categorie', 'processus', 'entite', 'proprietaire', 'statut', 'provenance',
  'graviteInherente', 'vraisemblanceInherente', 'niveauInherent',
  'graviteResiduelle', 'vraisemblanceResiduelle', 'niveauResiduel',
  'actionsTotal', 'actionsFaites', 'actionsEnRetard', 'tauxAvancement', 'creeLe',
]

// GET /api/risk-items/export — export CSV du registre de l'organisation active.
// Applique EXACTEMENT les mêmes filtres que l'affichage (lib/risk-filters), afin
// que l'export corresponde à ce que l'utilisateur voit. Injection de formules
// neutralisée via toCsvCell (CWE-1236), comme les autres exports.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as { id: string }).id
  const userRole = ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole

  const scope = await getAnalyseScope(userId, userRole)
  const orgId = scope.activeOrgId
  if (!orgId) return NextResponse.json({ error: 'Aucune organisation active' }, { status: 400 })
  const orgConfig = await getOrgConfig(orgId)
  if (!orgConfig.registreRisquesActive) return NextResponse.json({ error: 'Module non activé' }, { status: 403 })

  const rows = await prisma.riskItem.findMany({
    where: { organizationId: orgId },
    orderBy: [{ createdAt: 'desc' }],
    include: { processus: { select: { nom: true } }, actions: { select: { statut: true, echeance: true } } },
  })

  const now = new Date()
  const enriched = rows.map(r => ({
    ...r,
    processusNom: r.processus?.nom ?? null,
    niveauInherent: niveauRisque(r.graviteInherente, r.vraisemblanceInherente),
    niveauResiduel: niveauRisque(r.graviteResiduelle, r.vraisemblanceResiduelle),
    actionsSummary: summarizeActions(r.actions, now),
  }))

  const { searchParams } = new URL(req.url)
  const filters = parseFilters(searchParams)
  const filtered = applyFilters(enriched, filters)

  const format = (searchParams.get('format') ?? 'csv').toLowerCase()
  if (!['csv', 'xlsx', 'pdf'].includes(format)) {
    return NextResponse.json({ error: 'Format non supporté' }, { status: 400 })
  }

  await auditLog('ORGANIZATION_CONFIG_UPDATED', {
    userId, userRole, organizationId: orgId, ip: getClientIp(req),
    details: { scope: 'risk-item', action: 'export', format, lignes: filtered.length },
  })

  const stamp = now.toISOString().slice(0, 10)
  const mode = filters.mode === 'inherent' ? 'inherent' : 'residual'

  // Libellés de catégorie traduits dans la langue du rapport (repli : code brut).
  const langParam = searchParams.get('lang')
  const locale = ['fr', 'en', 'de', 'es', 'it'].includes(langParam ?? '') ? (langParam as string) : 'fr'
  const tCat = getT(locale)
  const trCat = (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], tCat) as string ?? ''
  const taxonomie = resolveTaxonomie(orgConfig.taxonomieRisques)
  const categorieLabel = (code: string): string | null => {
    const node = taxonomie.find(n => n.code === code)
    return node ? taxonomieLabel(node, trCat) : null
  }

  // ── XLSX : registre détaillé + synthèse de cartographie ────────────────────
  if (format === 'xlsx') {
    const S = sanitizeForSpreadsheet
    const wb = new ExcelJS.Workbook()
    wb.creator = 'ACRA — Augmented Cyber Risk Analysis'
    wb.created = now
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } }
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    const styleHeader = (ws: ExcelJS.Worksheet) => {
      ws.getRow(1).eachCell((c: ExcelJS.Cell) => { c.fill = headerFill; c.font = headerFont })
      ws.getRow(1).height = 20
    }

    const wsReg = wb.addWorksheet('Registre')
    wsReg.columns = HEADERS.map(h => ({ header: h, key: h, width: h === 'intitule' ? 40 : 16 }))
    for (const r of filtered) {
      wsReg.addRow({
        intitule: S(r.intitule), categorie: S(r.taxonomieCode ?? ''), processus: S(r.processusNom ?? ''),
        entite: S(r.entite ?? ''), proprietaire: S(r.proprietaire ?? ''), statut: r.statut, provenance: r.provenance,
        graviteInherente: r.graviteInherente ?? '', vraisemblanceInherente: r.vraisemblanceInherente ?? '', niveauInherent: r.niveauInherent ?? '',
        graviteResiduelle: r.graviteResiduelle ?? '', vraisemblanceResiduelle: r.vraisemblanceResiduelle ?? '', niveauResiduel: r.niveauResiduel ?? '',
        actionsTotal: r.actionsSummary.total, actionsFaites: r.actionsSummary.faits,
        actionsEnRetard: r.actionsSummary.enRetard, tauxAvancement: r.actionsSummary.tauxAvancement,
        creeLe: r.createdAt.toISOString().slice(0, 10),
      })
    }
    styleHeader(wsReg)

    // Feuille cartographie : heat map (grille) + ventilations.
    const carto = buildCartoExport(filtered as unknown as CartoExportRisk[], mode, categorieLabel)
    const wsCarto = wb.addWorksheet('Cartographie')
    wsCarto.columns = [{ width: 28 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }]
    wsCarto.addRow(['Cartographie des risques', `mode: ${mode}`])
    wsCarto.addRow([])
    wsCarto.addRow(['Total', carto.total])
    wsCarto.addRow(['Élevés', carto.parBucket.eleve])
    wsCarto.addRow(['Moyens', carto.parBucket.moyen])
    wsCarto.addRow(['Faibles', carto.parBucket.faible])
    wsCarto.addRow(['Non cotés', carto.nonCotes])
    wsCarto.addRow([])
    wsCarto.addRow(['Heat map (gravité ↓ × vraisemblance →)', ...carto.grid.vraisemblances.map(v => `V${v}`)])
    for (const g of carto.grid.gravites) {
      wsCarto.addRow([`G${g}`, ...carto.grid.vraisemblances.map(v => carto.grid.counts[g][v])])
    }
    const addBreakdown = (titre: string, rows: { key: string; label?: string | null; count: number; maxNiveau: number | null }[]) => {
      wsCarto.addRow([])
      wsCarto.addRow([titre, 'Nombre', 'Niveau max'])
      for (const r of rows) {
        wsCarto.addRow([S(r.label || r.key || 'Non renseigné'), r.count, r.maxNiveau ?? ''])
      }
    }
    addBreakdown('Par catégorie', carto.parCategorie)
    addBreakdown('Par processus', carto.parProcessus)
    addBreakdown('Par entité', carto.parEntite)

    const buf = await wb.xlsx.writeBuffer()
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="acra-cartographie-${stamp}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  // ── PDF : rapport de cartographie ─────────────────────────────────────────
  if (format === 'pdf') {
    try {
      // Template pré-compilé par esbuild, chargé au RUNTIME (SWC casse react-pdf).
      const nodeRequire = createRequire(process.cwd() + '/package.json')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { renderCartographiePDF } = nodeRequire(process.cwd() + '/.pdf-runtime/carto-pdf-template.cjs')
      const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { nom: true } })
      const carto = buildCartoExport(filtered as unknown as CartoExportRisk[], mode, categorieLabel)
      const buffer = await renderCartographiePDF(carto, locale, org?.nom ?? '', stamp)
      return new NextResponse(buffer as unknown as ArrayBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="acra-cartographie-${stamp}.pdf"`,
          'Cache-Control': 'no-store',
        },
      })
    } catch (err) {
      console.error('[export cartographie pdf] génération échouée', err)
      return NextResponse.json({ error: 'Échec de la génération du PDF' }, { status: 500 })
    }
  }

  // ── CSV (défaut) ──────────────────────────────────────────────────────────
  const lignes = filtered.map(r => [
    r.intitule, r.taxonomieCode ?? '', r.processusNom ?? '', r.entite ?? '', r.proprietaire ?? '', r.statut, r.provenance,
    r.graviteInherente ?? '', r.vraisemblanceInherente ?? '', r.niveauInherent ?? '',
    r.graviteResiduelle ?? '', r.vraisemblanceResiduelle ?? '', r.niveauResiduel ?? '',
    r.actionsSummary.total, r.actionsSummary.faits, r.actionsSummary.enRetard, r.actionsSummary.tauxAvancement,
    r.createdAt.toISOString().slice(0, 10),
  ].map(toCsvCell).join(','))

  // BOM UTF-8 : Excel reconnaît l'encodage et affiche correctement les accents.
  const csv = '﻿' + [HEADERS.join(','), ...lignes].join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="acra-registre-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
