/**
 * ras-pdf-template.tsx — Risk Appetite Statement (RAS), document de gouvernance.
 *
 * ⚠️ Mêmes contraintes que pdf-template.tsx :
 *   • AUCUN Fragment JSX (regrouper via <View>) — sinon « React error #31 » ;
 *   • jamais de chaîne potentiellement vide comme enfant direct d'un <View>
 *     (cf. lib/pdf-guards.ts) : toujours coercer les gardes en booléen.
 * Compilé en CJS autonome par scripts/compile-pdf-template.mjs puis chargé au
 * RUNTIME par la route d'export (SWC casse le rendu react-pdf).
 */

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { RasExportData } from '@/lib/ras-export'
import { isNonEmptyText } from '@/lib/pdf-guards'

const COLORS = {
  primary: '#4338CA',
  danger: '#DC2626',
  ok: '#16A34A',
  border: '#E5E7EB',
  muted: '#6B7280',
  headerBg: '#EEF2FF',
}

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: '#111827' },
  h1: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, marginBottom: 4 },
  sub: { fontSize: 9, color: COLORS.muted, marginBottom: 14 },
  intro: { fontSize: 9, color: '#374151', marginBottom: 12, lineHeight: 1.4 },
  h2: { fontSize: 12, fontWeight: 'bold', marginTop: 14, marginBottom: 6 },
  kpiRow: { flexDirection: 'row', marginBottom: 10 },
  kpi: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, padding: 8, marginRight: 6 },
  kpiLabel: { fontSize: 7, color: COLORS.muted, marginBottom: 2 },
  kpiValue: { fontSize: 14, fontWeight: 'bold' },
  statement: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, padding: 10, marginBottom: 8 },
  statementLabel: { fontSize: 8, color: COLORS.muted },
  statementValue: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  table: { marginTop: 4 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 3 },
  thRow: { flexDirection: 'row', backgroundColor: COLORS.headerBg, paddingVertical: 4 },
  th: { fontSize: 8, fontWeight: 'bold', paddingHorizontal: 4 },
  td: { fontSize: 8, paddingHorizontal: 4 },
  empty: { fontSize: 9, color: COLORS.muted, fontStyle: 'italic', marginTop: 4 },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 7, color: COLORS.muted, textAlign: 'center' },
})

type Strings = {
  title: string; subtitle: string; intro: string
  globalThreshold: string; noThreshold: string; scale: string
  byCategory: string; colCategory: string; colThreshold: string
  posture: string; compliance: string; outside: string; inside: string; evaluated: string
  breaches: string; colRisk: string; colResidual: string; colGap: string; noBreach: string
  generatedOn: string; approval: string
}

const STRINGS: Record<string, Strings> = {
  fr: { title: 'Déclaration d\'appétit au risque', subtitle: 'Risk Appetite Statement — document de gouvernance', intro: 'L\'appétit au risque exprime le niveau de risque résiduel maximum que l\'organisation accepte de supporter dans la poursuite de ses objectifs. Il se décline en un seuil global, surchargé au besoin par catégorie de risque. Tout risque dont le niveau résiduel dépasse le seuil applicable est « hors appétit » et doit faire l\'objet d\'un traitement ou d\'une décision d\'acceptation formelle.', globalThreshold: 'Seuil global d\'appétit', noThreshold: 'Non défini', scale: 'sur l\'échelle de niveau (1-25)', byCategory: 'Seuils par catégorie de risque', colCategory: 'Catégorie', colThreshold: 'Seuil', posture: 'Posture courante', compliance: 'Conformité', outside: 'Hors appétit', inside: 'Dans l\'appétit', evaluated: 'Évalués', breaches: 'Dépassements (risques hors appétit)', colRisk: 'Risque', colResidual: 'Niveau résiduel', colGap: 'Écart', noBreach: 'Aucun dépassement : tous les risques évaluables sont dans l\'appétit défini.', generatedOn: 'Généré le', approval: 'Approuvé par : ____________________   Date : __________' },
  en: { title: 'Risk Appetite Statement', subtitle: 'Governance document', intro: 'Risk appetite expresses the maximum level of residual risk the organisation is willing to bear in pursuit of its objectives. It is set as a global threshold, overridden where needed per risk category. Any risk whose residual level exceeds the applicable threshold is "outside appetite" and must be treated or formally accepted.', globalThreshold: 'Global appetite threshold', noThreshold: 'Not set', scale: 'on the level scale (1-25)', byCategory: 'Thresholds by risk category', colCategory: 'Category', colThreshold: 'Threshold', posture: 'Current posture', compliance: 'Compliance', outside: 'Outside appetite', inside: 'Within appetite', evaluated: 'Evaluated', breaches: 'Breaches (risks outside appetite)', colRisk: 'Risk', colResidual: 'Residual level', colGap: 'Gap', noBreach: 'No breach: all evaluable risks are within the defined appetite.', generatedOn: 'Generated on', approval: 'Approved by: ____________________   Date: __________' },
  de: { title: 'Risikoappetit-Erklärung', subtitle: 'Risk Appetite Statement — Governance-Dokument', intro: 'Der Risikoappetit drückt das maximale Restrisiko aus, das die Organisation zur Verfolgung ihrer Ziele zu tragen bereit ist. Er wird als globaler Schwellenwert festgelegt, bei Bedarf pro Risikokategorie überschrieben. Jedes Risiko, dessen Restniveau den anwendbaren Schwellenwert überschreitet, liegt „außerhalb des Appetits" und muss behandelt oder formell akzeptiert werden.', globalThreshold: 'Globaler Appetit-Schwellenwert', noThreshold: 'Nicht gesetzt', scale: 'auf der Niveau-Skala (1-25)', byCategory: 'Schwellenwerte nach Risikokategorie', colCategory: 'Kategorie', colThreshold: 'Schwelle', posture: 'Aktuelle Lage', compliance: 'Konformität', outside: 'Außerhalb', inside: 'Innerhalb', evaluated: 'Bewertet', breaches: 'Überschreitungen (Risiken außerhalb des Appetits)', colRisk: 'Risiko', colResidual: 'Restniveau', colGap: 'Abweichung', noBreach: 'Keine Überschreitung: alle bewertbaren Risiken liegen innerhalb des Appetits.', generatedOn: 'Erstellt am', approval: 'Genehmigt von: ____________________   Datum: __________' },
  es: { title: 'Declaración de apetito de riesgo', subtitle: 'Risk Appetite Statement — documento de gobernanza', intro: 'El apetito de riesgo expresa el nivel máximo de riesgo residual que la organización acepta soportar en la consecución de sus objetivos. Se define como un umbral global, sustituido cuando es necesario por categoría de riesgo. Todo riesgo cuyo nivel residual supere el umbral aplicable queda «fuera del apetito» y debe tratarse o aceptarse formalmente.', globalThreshold: 'Umbral global de apetito', noThreshold: 'Sin definir', scale: 'en la escala de nivel (1-25)', byCategory: 'Umbrales por categoría de riesgo', colCategory: 'Categoría', colThreshold: 'Umbral', posture: 'Postura actual', compliance: 'Conformidad', outside: 'Fuera del apetito', inside: 'Dentro del apetito', evaluated: 'Evaluados', breaches: 'Superaciones (riesgos fuera del apetito)', colRisk: 'Riesgo', colResidual: 'Nivel residual', colGap: 'Diferencia', noBreach: 'Ninguna superación: todos los riesgos evaluables están dentro del apetito definido.', generatedOn: 'Generado el', approval: 'Aprobado por: ____________________   Fecha: __________' },
  it: { title: 'Dichiarazione di propensione al rischio', subtitle: 'Risk Appetite Statement — documento di governance', intro: 'La propensione al rischio esprime il livello massimo di rischio residuo che l\'organizzazione accetta di sostenere nel perseguire i propri obiettivi. È definita come una soglia globale, sovrascritta ove necessario per categoria di rischio. Ogni rischio il cui livello residuo supera la soglia applicabile è «fuori propensione» e deve essere trattato o accettato formalmente.', globalThreshold: 'Soglia globale di propensione', noThreshold: 'Non definita', scale: 'sulla scala di livello (1-25)', byCategory: 'Soglie per categoria di rischio', colCategory: 'Categoria', colThreshold: 'Soglia', posture: 'Postura attuale', compliance: 'Conformità', outside: 'Fuori propensione', inside: 'Entro la propensione', evaluated: 'Valutati', breaches: 'Superamenti (rischi fuori propensione)', colRisk: 'Rischio', colResidual: 'Livello residuo', colGap: 'Scarto', noBreach: 'Nessun superamento: tutti i rischi valutabili rientrano nella propensione definita.', generatedOn: 'Generato il', approval: 'Approvato da: ____________________   Data: __________' },
}

function RasPDF({ data, locale, orgNom, dateStr }: { data: RasExportData; locale: string; orgNom: string; dateStr: string }) {
  const S = STRINGS[locale] ?? STRINGS.fr
  const hasCategories = data.categories.length > 0
  const hasBreaches = data.depassements.length > 0
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{S.title}</Text>
        <View>
          <Text style={s.sub}>{isNonEmptyText(orgNom) ? `${orgNom} — ` : ''}{S.subtitle}</Text>
        </View>

        <Text style={s.intro}>{S.intro}</Text>

        {/* Seuil global */}
        <View style={s.statement}>
          <Text style={s.statementLabel}>{S.globalThreshold}</Text>
          <Text style={s.statementValue}>
            {data.seuilGlobal == null ? S.noThreshold : `${data.seuilGlobal} / 25`}
          </Text>
          <Text style={s.statementLabel}>{S.scale}</Text>
        </View>

        {/* Seuils par catégorie */}
        <View wrap={false}>
          <Text style={s.h2}>{S.byCategory}</Text>
          {Boolean(hasCategories) && (
            <View style={s.table}>
              <View style={s.thRow}>
                <Text style={[s.th, { width: 360 }]}>{S.colCategory}</Text>
                <Text style={[s.th, { width: 80, textAlign: 'right' }]}>{S.colThreshold}</Text>
              </View>
              {data.categories.map((c, i) => (
                <View key={`${c.code}-${i}`} style={s.tr}>
                  <Text style={[s.td, { width: 360 }]}>{isNonEmptyText(c.label) ? c.label : c.code}</Text>
                  <Text style={[s.td, { width: 80, textAlign: 'right' }]}>{`${c.seuil} / 25`}</Text>
                </View>
              ))}
            </View>
          )}
          {Boolean(!hasCategories) && <Text style={s.empty}>—</Text>}
        </View>

        {/* Posture courante */}
        <Text style={s.h2}>{S.posture}</Text>
        <View style={s.kpiRow}>
          <View style={s.kpi}><Text style={s.kpiLabel}>{S.compliance}</Text><Text style={[s.kpiValue, { color: data.tauxConformite >= 80 ? COLORS.ok : COLORS.danger }]}>{`${data.tauxConformite}%`}</Text></View>
          <View style={s.kpi}><Text style={s.kpiLabel}>{S.outside}</Text><Text style={[s.kpiValue, { color: data.synthese.horsAppetit > 0 ? COLORS.danger : COLORS.ok }]}>{String(data.synthese.horsAppetit)}</Text></View>
          <View style={s.kpi}><Text style={s.kpiLabel}>{S.inside}</Text><Text style={s.kpiValue}>{String(data.synthese.dansAppetit)}</Text></View>
          <View style={s.kpi}><Text style={s.kpiLabel}>{S.evaluated}</Text><Text style={s.kpiValue}>{String(data.synthese.evalues)}</Text></View>
        </View>

        {/* Dépassements */}
        <View>
          <Text style={s.h2}>{S.breaches}</Text>
          {Boolean(hasBreaches) && (
            <View style={s.table}>
              <View style={s.thRow}>
                <Text style={[s.th, { width: 300 }]}>{S.colRisk}</Text>
                <Text style={[s.th, { width: 90 }]}>{S.colCategory}</Text>
                <Text style={[s.th, { width: 60, textAlign: 'right' }]}>{S.colResidual}</Text>
                <Text style={[s.th, { width: 50, textAlign: 'right' }]}>{S.colGap}</Text>
              </View>
              {data.depassements.map((d, i) => (
                <View key={`d-${i}`} style={s.tr}>
                  <Text style={[s.td, { width: 300 }]}>{isNonEmptyText(d.intitule) ? d.intitule : '—'}</Text>
                  <Text style={[s.td, { width: 90 }]}>{isNonEmptyText(d.categorieLabel) ? d.categorieLabel : '—'}</Text>
                  <Text style={[s.td, { width: 60, textAlign: 'right' }]}>{String(d.niveauResiduel)}</Text>
                  <Text style={[s.td, { width: 50, textAlign: 'right', color: COLORS.danger }]}>{`+${d.ecart}`}</Text>
                </View>
              ))}
            </View>
          )}
          {Boolean(!hasBreaches) && <Text style={s.empty}>{S.noBreach}</Text>}
        </View>

        <View style={{ marginTop: 24 }}>
          <Text style={{ fontSize: 8, color: COLORS.muted }}>{S.approval}</Text>
        </View>

        <Text style={s.footer} fixed>{`ACRA — ${S.generatedOn} ${dateStr}`}</Text>
      </Page>
    </Document>
  )
}

/** Rend le PDF du RAS. Appelé au runtime depuis la route d'export. */
export function renderRasPDF(data: RasExportData, locale: string, orgNom: string, dateStr: string): Promise<Buffer> {
  return renderToBuffer(<RasPDF data={data} locale={locale} orgNom={orgNom} dateStr={dateStr} />)
}
