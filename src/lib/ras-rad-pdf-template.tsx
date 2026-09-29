/** Export comité RAS/RAD. Compilé en runtime CJS comme les autres templates PDF. */
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

type Voyant = 'VERT' | 'ORANGE' | 'ROUGE' | 'GRIS'
type Data = {
  global: Voyant
  appetit: { seuilGlobal: number | null; synthese: { evalues: number; horsAppetit: number }; voyant: Voyant } | null
  maturite: { nom: string; averageCurrent: number | null; averageTarget: number | null; belowTarget: number; voyant: Voyant }[]
  kri: { total: number; alerte: number; critique: number; voyant: Voyant } | null
}

const COLOR: Record<Voyant, string> = { VERT: '#15803D', ORANGE: '#D97706', ROUGE: '#DC2626', GRIS: '#6B7280' }
const s = StyleSheet.create({ page: { padding: 36, fontSize: 9, color: '#111827' }, h1: { fontSize: 18, fontWeight: 'bold', color: '#4338CA' }, sub: { color: '#6B7280', marginTop: 3, marginBottom: 16 }, h2: { fontSize: 12, fontWeight: 'bold', marginTop: 14, marginBottom: 6 }, row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingVertical: 5 }, head: { flexDirection: 'row', backgroundColor: '#EEF2FF', paddingVertical: 5 }, cell: { paddingHorizontal: 4, fontSize: 8 }, card: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 4, padding: 8, marginBottom: 6 }, footer: { position: 'absolute', bottom: 20, left: 36, right: 36, textAlign: 'center', color: '#6B7280', fontSize: 7 } })
const STRINGS: Record<string, { title: string; generated: string; overall: string; ras: string; threshold: string; evaluated: string; outside: string; dashboard: string; indicator: string; position: string; status: string; residual: string; maturity: string; unprovided: string; footer: string; labels: Record<Voyant, string> }> = {
  fr: { title: 'RAS / RAD — Appétence et tableau de bord du risque', generated: 'Généré le', overall: 'Voyant global', ras: 'Déclaration d’appétence (RAS)', threshold: 'Seuil global', evaluated: 'Risques évalués', outside: 'Hors appétit', dashboard: 'Tableau de bord (RAD)', indicator: 'Indicateur', position: 'Position', status: 'Voyant', residual: 'Appétence résiduelle', maturity: 'Maturité', unprovided: 'Non renseigné', footer: 'ACRA — document de pilotage ; les voyants soutiennent la décision et ne valent pas approbation.', labels: { VERT: 'Vert', ORANGE: 'Orange', ROUGE: 'Rouge', GRIS: 'Non renseigné' } },
  en: { title: 'RAS / RAD — Risk appetite and dashboard', generated: 'Generated on', overall: 'Overall status', ras: 'Risk appetite statement (RAS)', threshold: 'Overall threshold', evaluated: 'Assessed risks', outside: 'Outside appetite', dashboard: 'Risk appetite dashboard (RAD)', indicator: 'Indicator', position: 'Position', status: 'Status', residual: 'Residual appetite', maturity: 'Maturity', unprovided: 'Not provided', footer: 'ACRA — management document; indicators support decisions and do not constitute approval.', labels: { VERT: 'Green', ORANGE: 'Amber', ROUGE: 'Red', GRIS: 'Not provided' } },
}
const strings = (locale: string) => STRINGS[locale] ?? STRINGS.fr

function Report({ data, org, stamp, locale }: { data: Data; org: string; stamp: string; locale: string }) {
  const S = strings(locale)
  const label = S.labels
  const appetite = data.appetit
  return <Document><Page size="A4" style={s.page}>
    <Text style={s.h1}>{S.title}</Text><Text style={s.sub}>{org} · {S.generated} {stamp}</Text>
    <View style={s.card}><Text>{S.overall}</Text><Text style={{ fontSize: 18, fontWeight: 'bold', color: COLOR[data.global] }}>{label[data.global]}</Text></View>
    <Text style={s.h2}>{S.ras}</Text>
    <View style={s.card}><Text>{S.threshold}: {appetite?.seuilGlobal ?? S.unprovided} / 25</Text><Text>{S.evaluated}: {appetite?.synthese.evalues ?? 0} · {S.outside}: {appetite?.synthese.horsAppetit ?? 0}</Text><Text style={{ color: COLOR[appetite?.voyant ?? 'GRIS'] }}>{S.status}: {label[appetite?.voyant ?? 'GRIS']}</Text></View>
    <Text style={s.h2}>{S.dashboard}</Text>
    <View style={s.head}><Text style={[s.cell, { width: 230, fontWeight: 'bold' }]}>{S.indicator}</Text><Text style={[s.cell, { width: 150, fontWeight: 'bold' }]}>{S.position}</Text><Text style={[s.cell, { width: 100, fontWeight: 'bold' }]}>{S.status}</Text></View>
    <View style={s.row}><Text style={[s.cell, { width: 230 }]}>{S.residual}</Text><Text style={[s.cell, { width: 150 }]}>{appetite ? `${appetite.synthese.horsAppetit} ${S.outside.toLowerCase()}` : S.unprovided}</Text><Text style={[s.cell, { width: 100, color: COLOR[appetite?.voyant ?? 'GRIS'] }]}>{label[appetite?.voyant ?? 'GRIS']}</Text></View>
    {data.maturite.map(m => <View key={m.nom} style={s.row}><Text style={[s.cell, { width: 230 }]}>{`${S.maturity} — ${m.nom}`}</Text><Text style={[s.cell, { width: 150 }]}>{`${m.averageCurrent ?? '—'} / ${m.averageTarget ?? '—'} · ${m.belowTarget}`}</Text><Text style={[s.cell, { width: 100, color: COLOR[m.voyant] }]}>{label[m.voyant]}</Text></View>)}
    <View style={s.row}><Text style={[s.cell, { width: 230 }]}>KRI</Text><Text style={[s.cell, { width: 150 }]}>{data.kri ? `${data.kri.critique} / ${data.kri.alerte}` : S.unprovided}</Text><Text style={[s.cell, { width: 100, color: COLOR[data.kri?.voyant ?? 'GRIS'] }]}>{label[data.kri?.voyant ?? 'GRIS']}</Text></View>
    <Text style={s.footer} fixed>{S.footer}</Text>
  </Page></Document>
}
export function renderRasRadPDF(data: Data, org: string, stamp: string, locale = 'fr'): Promise<Buffer> { return renderToBuffer(<Report data={data} org={org} stamp={stamp} locale={locale} />) }
