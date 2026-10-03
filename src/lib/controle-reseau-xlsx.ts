// Export Excel des contrôles de référence en réseau : une ligne par contrôle, une colonne par entité, synthèse.
import ExcelJS from 'exceljs'
import { sanitizeForSpreadsheet as S } from './spreadsheet-safe'
import type { Cellule, Synthese } from './controle-reseau'
import type { Translations } from './i18n/fr'

type Labels = Translations['controleReseau']

const FOND: Record<string, string> = { CONFORME: 'FFD1FAE5', ANOMALIE: 'FFFEE2E2', EN_RETARD: 'FFFEF3C7', JAMAIS: 'FFF3F4F6' }

export async function buildReseauXlsx(
  data: { entites: { id: string; nom: string }[]; references: { intitule: string; cellules: Cellule[]; synthese: Synthese }[] },
  o: { labels: Labels; organisation: string; now: Date },
): Promise<Buffer> {
  const l = o.labels
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ACRA — Augmented Cyber (& Business) Risk Analysis'; wb.created = o.now
  const ws = wb.addWorksheet(l.references.slice(0, 31))
  ws.columns = [l.colControle, ...data.entites.map(e => S(e.nom)), l.taux, l.colSynthese].map((h, i) => ({ header: h, width: i === 0 ? 40 : 26 }))
  const head = ws.getRow(1); head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  head.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } } })
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }]
  for (const r of data.references) {
    const parOrg = new Map(r.cellules.map(c => [c.organizationId, c]))
    const cellules = data.entites.map(e => {
      const c = parOrg.get(e.id)
      if (!c) return l.absent
      const res = c.dernierResultat ? l.resultats[c.dernierResultat as keyof Labels['resultats']] ?? c.dernierResultat : null
      return [res, l.etat[c.etat], c.derniereExecution ? c.derniereExecution.toISOString().slice(0, 10) : null].filter(Boolean).join(' — ')
    })
    const s = r.synthese
    const synthese = [l.entitesCount.replace('{n}', String(s.entites)), l.enRetard.replace('{n}', String(s.enRetard)), l.sansExecution.replace('{n}', String(s.sansExecution))].join(' · ')
    const row = ws.addRow([S(r.intitule), ...cellules, s.taux == null ? '—' : `${s.taux} %`, synthese])
    data.entites.forEach((e, i) => {
      const c = parOrg.get(e.id)
      const fond = c ? FOND[c.etat === 'EN_RETARD' || c.etat === 'JAMAIS' ? c.etat : c.dernierResultat ?? ''] : undefined
      if (fond) row.getCell(i + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fond } }
    })
  }
  const info = wb.addWorksheet('Info'); info.columns = [{ width: 24 }, { width: 80 }]
  info.addRow([l.title, S(o.organisation)]); info.addRow(['', o.now.toISOString().slice(0, 10)])
  return Buffer.from(await wb.xlsx.writeBuffer())
}
