// ─── Export Excel des évaluations d'usages de services tiers (lot T2) ─────────
// Une ligne par usage (organisation active, ou sous-arbre visible pour une tête de groupe) : tiers, offre, organisation,
// cas d'usage, processus, criticité, statut, menace et zone actuelles / cibles, prochaine réévaluation, clauses.
// Libellés repris des traductions de l'application (aucune duplication) ; chaînes neutralisées contre l'injection de
// formule (CWE-1236). Testé : tier-evaluation-xlsx.test.ts.
import ExcelJS from 'exceljs'
import { getT } from '@/lib/i18n'
import { sanitizeForSpreadsheet as S } from './spreadsheet-safe'

export type LangueExport = 'fr' | 'en' | 'de' | 'es' | 'it'
export interface LigneExportTiers {
  tiers: string; offre: string; organisation: string; usage: string; processus: string | null; criticite: string | null; statut: string | null
  actuelle: { menace: number; zone: string } | null; cible: { menace: number; zone: string } | null; prochaine: string | null; clauses: string[]
}
const FEUILLE: Record<LangueExport, string> = { fr: 'Évaluation des tiers', en: 'Third-party assessment', de: 'Bewertung der Drittanbieter', es: 'Evaluación de terceros', it: 'Valutazione dei terzi' }

export async function buildTierEvaluationWorkbook(lignes: LigneExportTiers[], lang: LangueExport): Promise<Buffer> {
  const t = getT(lang)
  const e = t.tierEval
  const a3 = t.workshop.a3
  const zone = (z: string) => ({ danger: a3.radar.zoneDanger, controle: a3.radar.zoneControle, veille: a3.radar.zoneVeille } as Record<string, string>)[z] ?? z
  const menace = (m: number) => Math.round(m * 100) / 100
  const crit = t.tierDetail.criticalityLabels as Record<string, string>
  const clauses = a3.measClauses as Record<string, string>
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(FEUILLE[lang])
  ws.addRow([e.colTiers, e.colOffre, e.colOrganisation, e.colUsage, e.colProcessus, t.tierDetail.criticality,
    e.colStatut, `${e.menace} — ${e.actuelle}`, `${e.colZone} — ${e.actuelle}`, `${e.menace} — ${e.cible}`, `${e.colZone} — ${e.cible}`, e.colProchaine, e.clauses].map(v => S(String(v))))
  ws.getRow(1).font = { bold: true }
  for (const l of lignes) {
    ws.addRow([
      S(l.tiers), S(l.offre), S(l.organisation), S(l.usage), S(l.processus ?? ''), l.criticite ? crit[l.criticite] ?? l.criticite : '',
      l.statut ? (e.statuts as Record<string, string>)[l.statut] ?? l.statut : e.nonEvalue,
      l.actuelle ? menace(l.actuelle.menace) : '', l.actuelle ? zone(l.actuelle.zone) : '', l.cible ? menace(l.cible.menace) : '', l.cible ? zone(l.cible.zone) : '',
      l.prochaine ?? '', S(l.clauses.map(k => clauses[k] ?? k).join(' ; ')),
    ])
  }
  ws.columns.forEach(c => { c.width = 24 })
  return Buffer.from(await wb.xlsx.writeBuffer())
}
