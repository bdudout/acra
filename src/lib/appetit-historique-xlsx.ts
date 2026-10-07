// Export Excel de l'historique d'appétence : une ligne par mois (agrégats et tendance).
import ExcelJS from 'exceljs'
import { sanitizeForSpreadsheet as S } from './spreadsheet-safe'
import type { Tendance } from './appetit-historique'

type Lang = 'fr' | 'en' | 'de' | 'es' | 'it'
const L: Record<Lang, { readme: string; sheet: string; org: string; generated: string; notice: string; periode: string; global: string; evalues: string; hors: string; kriTotal: string; kriAlerte: string; kriCritique: string; matSous: string; sens: string; AMELIORATION: string; DEGRADATION: string; STABLE: string; voyants: Record<string, string> }> = {
  fr: { readme: 'Lisez-moi', sheet: 'Historique', org: 'Organisation', generated: 'Généré le', notice: 'Instantanés mensuels d’agrégats (aucun intitulé de risque). L’historique commence au premier instantané capturé. Tendance : solde des écarts avec le mois précédent (risques hors appétit, KRI en alerte ou critiques, exigences sous la maturité cible).', periode: 'Période', global: 'Niveau global', evalues: 'Risques évalués', hors: 'Hors appétit', kriTotal: 'KRI', kriAlerte: 'KRI en alerte', kriCritique: 'KRI critiques', matSous: 'Exigences sous la cible de maturité', sens: 'Tendance', AMELIORATION: 'Amélioration', DEGRADATION: 'Dégradation', STABLE: 'Stable', voyants: { VERT: 'Vert', ORANGE: 'Orange', ROUGE: 'Rouge', GRIS: 'Non évalué' } },
  en: { readme: 'Read me', sheet: 'History', org: 'Organisation', generated: 'Generated on', notice: 'Monthly snapshots of aggregates (no risk titles). History starts at the first snapshot captured. Trend: net change against the previous month (risks beyond appetite, KRIs in alert or critical, requirements below target maturity).', periode: 'Period', global: 'Overall level', evalues: 'Risks assessed', hors: 'Beyond appetite', kriTotal: 'KRIs', kriAlerte: 'KRIs in alert', kriCritique: 'Critical KRIs', matSous: 'Requirements below target maturity', sens: 'Trend', AMELIORATION: 'Improving', DEGRADATION: 'Worsening', STABLE: 'Stable', voyants: { VERT: 'Green', ORANGE: 'Amber', ROUGE: 'Red', GRIS: 'Not assessed' } },
  de: { readme: 'Hinweise', sheet: 'Verlauf', org: 'Organisation', generated: 'Erstellt am', notice: 'Monatliche Momentaufnahmen von Aggregaten (keine Risikobezeichnungen). Der Verlauf beginnt mit der ersten erfassten Momentaufnahme. Trend: Saldo der Änderungen gegenüber dem Vormonat (Risiken über dem Appetit, KRI in Warnung oder kritisch, Anforderungen unter dem Reifegradziel).', periode: 'Zeitraum', global: 'Gesamtniveau', evalues: 'Bewertete Risiken', hors: 'Über Risikoappetit', kriTotal: 'KRI', kriAlerte: 'KRI in Warnung', kriCritique: 'Kritische KRI', matSous: 'Anforderungen unter Reifegradziel', sens: 'Trend', AMELIORATION: 'Verbesserung', DEGRADATION: 'Verschlechterung', STABLE: 'Stabil', voyants: { VERT: 'Grün', ORANGE: 'Orange', ROUGE: 'Rot', GRIS: 'Nicht bewertet' } },
  es: { readme: 'Léame', sheet: 'Histórico', org: 'Organización', generated: 'Generado el', notice: 'Instantáneas mensuales de agregados (sin títulos de riesgo). El histórico comienza en la primera instantánea capturada. Tendencia: saldo de las variaciones respecto al mes anterior (riesgos fuera del apetito, KRI en alerta o críticos, requisitos bajo la madurez objetivo).', periode: 'Período', global: 'Nivel global', evalues: 'Riesgos evaluados', hors: 'Fuera del apetito', kriTotal: 'KRI', kriAlerte: 'KRI en alerta', kriCritique: 'KRI críticos', matSous: 'Requisitos bajo la madurez objetivo', sens: 'Tendencia', AMELIORATION: 'Mejora', DEGRADATION: 'Empeora', STABLE: 'Estable', voyants: { VERT: 'Verde', ORANGE: 'Naranja', ROUGE: 'Rojo', GRIS: 'No evaluado' } },
  it: { readme: 'Leggimi', sheet: 'Storico', org: 'Organizzazione', generated: 'Generato il', notice: 'Istantanee mensili di aggregati (nessun titolo di rischio). Lo storico inizia con la prima istantanea acquisita. Tendenza: saldo delle variazioni rispetto al mese precedente (rischi oltre l’appetito, KRI in allerta o critici, requisiti sotto la maturità obiettivo).', periode: 'Periodo', global: 'Livello globale', evalues: 'Rischi valutati', hors: 'Oltre l’appetito', kriTotal: 'KRI', kriAlerte: 'KRI in allerta', kriCritique: 'KRI critici', matSous: 'Requisiti sotto la maturità obiettivo', sens: 'Tendenza', AMELIORATION: 'Miglioramento', DEGRADATION: 'Peggioramento', STABLE: 'Stabile', voyants: { VERT: 'Verde', ORANGE: 'Arancione', ROUGE: 'Rosso', GRIS: 'Non valutato' } },
}

export async function buildHistoriqueXlsx(t: Tendance[], o: { lang: Lang; now: Date; organisation: string }): Promise<Buffer> {
  const l = L[o.lang] ?? L.fr
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ACRA — Augmented Cyber (& Business) Risk Analysis'; wb.created = o.now
  const info = wb.addWorksheet(l.readme); info.columns = [{ width: 28 }, { width: 110 }]
  info.addRow([l.org, S(o.organisation)]); info.addRow([l.generated, o.now.toISOString().slice(0, 10)]); info.addRow([]); info.addRow([S(l.notice)])
  const ws = wb.addWorksheet(l.sheet)
  ws.columns = [l.periode, l.global, l.evalues, l.hors, l.kriTotal, l.kriAlerte, l.kriCritique, l.matSous, l.sens].map((h, i) => ({ header: h, width: i === 7 ? 34 : 16 }))
  const head = ws.getRow(1); head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  head.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } } })
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  for (const x of t) {
    const r = x.resume
    ws.addRow([x.periode, l.voyants[r.global] ?? r.global, r.appetit?.evalues ?? '', r.appetit?.horsAppetit ?? '', r.kri?.total ?? '', r.kri?.alerte ?? '', r.kri?.critique ?? '', r.maturite.reduce((n, m) => n + m.belowTarget, 0), x.sens ? l[x.sens] : ''])
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}
