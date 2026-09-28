// ─── Rapport Excel des méthodes à saisie directe (P4) ────────────────────────
// Même modèle que le PDF (`buildDirectReport`), une feuille par partie :
// Synthèse, Registre, Vulnérabilités, Mesures, Plans d'action. Tous les textes
// saisis passent par `sanitizeForSpreadsheet` (injection de formule neutralisée).

import ExcelJS from 'exceljs'
import { sanitizeForSpreadsheet } from '@/lib/spreadsheet-safe'
import { reportStrings, criterionText, type DirectReport } from '@/lib/rapport-methode-directe'

/** Nom de feuille valide (31 caractères, sans caractères interdits par Excel). */
const sheetName = (s: string) => s.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)
const cell = (v: unknown) => (typeof v === 'number' ? v : v == null ? '' : sanitizeForSpreadsheet(v))

function addTable(wb: ExcelJS.Workbook, name: string, headers: string[], rows: unknown[][], widths: number[]) {
  const ws = wb.addWorksheet(sheetName(name))
  ws.addRow(headers).font = { bold: true }
  for (const r of rows) ws.addRow(r.map(cell))
  ws.columns.forEach((c, i) => { c.width = widths[i] ?? 14 })
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  return ws
}

/** Construit le classeur du rapport dans la langue demandée. */
export async function buildDirectReportWorkbook(report: DirectReport, locale: string): Promise<ExcelJS.Workbook> {
  const S = reportStrings(locale)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ACRA'

  const sy = report.synthese
  const syn = wb.addWorksheet(sheetName(S.summary))
  const lines: [string, unknown][] = [
    [S.reportTitle, report.titre], [S.method, report.standard],
    [S.scope, report.contexte.perimetre ?? S.notProvided], [S.objectives, report.contexte.objectifs ?? S.notProvided],
    ['', ''],
    [S.total, sy.total], [S.toTreat, sy.aTraiter], [S.acceptable, sy.acceptables], [S.noOwner, sy.sansProprietaire],
    [S.measures, sy.mesures], [S.plans, sy.plans], ['', ''], [S.byBand, ''],
    ...sy.parPalier.map(p => [p.label, p.count] as [string, unknown]),
    ['', ''], [S.evalNote, ''],
  ]
  for (const [k, v] of lines) syn.addRow([cell(k), cell(v)])
  syn.getColumn(1).width = 34; syn.getColumn(2).width = 60
  syn.getColumn(1).font = { bold: true }

  addTable(wb, S.register,
    [S.colRef, S.colRisk, S.colOwner, `${S.colInherent} G`, `${S.colInherent} V`, S.colInherent, `${S.colCurrent} G`, `${S.colCurrent} V`, S.colCurrent,
      `${S.colResidual} G`, `${S.colResidual} V`, S.colResidual, S.colBand, S.colDecision, S.colCriterion, S.colTreatment, S.measures, S.plans],
    report.registre.map(r => [
      r.ref, r.nom, r.proprietaire ?? '', r.brut.gravite, r.brut.vraisemblance, r.brut.niveau,
      r.actuel.gravite, r.actuel.vraisemblance, r.actuel.niveau, r.residuel.gravite, r.residuel.vraisemblance, r.residuel.niveau,
      r.palier.label, r.decision === 'treat' ? S.decisionTreat : S.decisionAccept, criterionText(r, S), S.strategies[r.strategie] ?? r.strategie,
      r.nbMesures, r.nbPlans,
    ]),
    [6, 44, 20, 7, 7, 8, 7, 7, 8, 7, 7, 8, 12, 12, 20, 12, 9, 9])

  addTable(wb, S.vulnerabilities, [S.colRef, S.colRisk, S.colVulnerability],
    report.vulnerabilites.map(v => [v.ref, v.risque, v.description]), [6, 44, 60])

  addTable(wb, S.measures, [S.colRef, S.measures, S.colStatus, S.colEfficacy, S.colDue, S.colResponsible],
    report.mesures.map(m => [m.ref, m.nom, S.measureStatus[m.statut] ?? m.statut, m.efficacite, m.echeance ?? '', m.responsable ?? '']),
    [6, 50, 14, 11, 12, 24])

  addTable(wb, S.plans, [S.colRisks, S.colAction, S.colStatus, S.colPriority, S.colDue, S.colResponsible],
    report.plans.map(p => [p.refs, p.titre, S.planStatus[p.statut] ?? p.statut, S.priorities[p.priorite] ?? p.priorite, p.echeance ?? '', p.porteur ?? '']),
    [12, 50, 14, 12, 12, 24])

  return wb
}
