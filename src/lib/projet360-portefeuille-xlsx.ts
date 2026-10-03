// Export Excel du portefeuille de projets 360 (une ligne par projet, une colonne par domaine : « nombre / niveau maximal »).
import ExcelJS from 'exceljs'
import { sanitizeForSpreadsheet as S } from './spreadsheet-safe'
import { DOMAINES_360 } from './projet360'
import type { Portefeuille360 } from './projet360-portefeuille'

type Lang = 'fr' | 'en' | 'de' | 'es' | 'it'
const L: Record<Lang, { readme: string; sheet: string; project: string; status: string; total: string; above: string; unclassified: string; max: string; org: string; generated: string; appetite: string; none: string; notice: string }> = {
  fr: { readme: 'Lisez-moi', sheet: 'Portefeuille', project: 'Projet', status: 'Statut', total: 'Risques', above: 'Au-dessus de l’appétit', unclassified: 'Sans domaine', max: 'Niveau max', org: 'Organisation', generated: 'Généré le', appetite: 'Seuil d’appétit', none: 'non défini', notice: 'Chaque cellule de domaine indique « nombre de risques / niveau le plus élevé » (résiduel s’il est coté, sinon brut). Les niveaux au-dessus du seuil d’appétit sont signalés en rouge.' },
  en: { readme: 'Read me', sheet: 'Portfolio', project: 'Project', status: 'Status', total: 'Risks', above: 'Above appetite', unclassified: 'No domain', max: 'Max level', org: 'Organisation', generated: 'Generated on', appetite: 'Appetite threshold', none: 'not set', notice: 'Each domain cell shows “number of risks / highest level” (residual if rated, otherwise gross). Levels above the appetite threshold are shown in red.' },
  de: { readme: 'Hinweise', sheet: 'Portfolio', project: 'Projekt', status: 'Status', total: 'Risiken', above: 'Über Risikoappetit', unclassified: 'Ohne Domäne', max: 'Höchststufe', org: 'Organisation', generated: 'Erstellt am', appetite: 'Risikoappetit-Schwelle', none: 'nicht festgelegt', notice: 'Jede Domänenzelle zeigt „Anzahl Risiken / höchste Stufe“ (Restrisiko, falls bewertet, sonst brutto). Stufen über der Appetit-Schwelle sind rot markiert.' },
  es: { readme: 'Léame', sheet: 'Cartera', project: 'Proyecto', status: 'Estado', total: 'Riesgos', above: 'Sobre el apetito', unclassified: 'Sin dominio', max: 'Nivel máx.', org: 'Organización', generated: 'Generado el', appetite: 'Umbral de apetito', none: 'no definido', notice: 'Cada celda de dominio indica «número de riesgos / nivel más alto» (residual si está valorado, si no bruto). Los niveles por encima del umbral de apetito aparecen en rojo.' },
  it: { readme: 'Leggimi', sheet: 'Portafoglio', project: 'Progetto', status: 'Stato', total: 'Rischi', above: 'Sopra l’appetito', unclassified: 'Senza dominio', max: 'Livello max', org: 'Organizzazione', generated: 'Generato il', appetite: 'Soglia di appetito', none: 'non definita', notice: 'Ogni cella di dominio indica «numero di rischi / livello più alto» (residuo se valutato, altrimenti lordo). I livelli sopra la soglia di appetito sono in rosso.' },
}

export async function buildPortefeuille360Xlsx(p: Portefeuille360, opts: { lang: Lang; now: Date; organisation: string }): Promise<Buffer> {
  const t = L[opts.lang] ?? L.fr
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ACRA — Augmented Cyber (& Business) Risk Analysis'; wb.created = opts.now
  const info = wb.addWorksheet(t.readme)
  info.columns = [{ width: 28 }, { width: 110 }]
  info.addRow([t.org, S(opts.organisation)]); info.addRow([t.generated, opts.now.toISOString().slice(0, 10)])
  info.addRow([t.appetite, p.appetit ?? t.none]); info.addRow([]); info.addRow([S(t.notice)])
  const ws = wb.addWorksheet(t.sheet)
  ws.columns = [{ header: t.project, width: 38 }, { header: t.status, width: 14 }, ...DOMAINES_360.map(d => ({ header: d, width: 14 })), { header: t.unclassified, width: 14 }, { header: t.total, width: 10 }, { header: t.max, width: 11 }, { header: t.above, width: 20 }]
  const head = ws.getRow(1); head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  head.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } } })
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }]
  for (const l of p.projetsTries) {
    const row = ws.addRow([S(l.nom), S(l.statut), ...DOMAINES_360.map(d => { const c = l.parDomaine[d]; return c.count ? `${c.count} / ${c.maxEffectif}` : '' }), l.nonClasses || '', l.total, l.maxEffectif ?? '', l.auDessusAppetit])
    DOMAINES_360.forEach((d, i) => { if (l.parDomaine[d].auDessusAppetit > 0) row.getCell(3 + i).font = { bold: true, color: { argb: 'FFB91C1C' } } })
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}
