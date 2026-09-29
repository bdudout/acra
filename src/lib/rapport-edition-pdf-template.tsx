/**
 * rapport-edition-pdf-template.tsx — PDF serveur d'une édition de rapport GRC (lot L2, suite).
 * Rend un `DocumentRapport` (modèle plat déjà traduit, cf. rapport-render.contenuVersDocument).
 *
 * ⚠️ Mêmes contraintes que pdf-template.tsx : AUCUN Fragment JSX ; jamais de chaîne vide enfant
 * direct d'un <View> (gardes booléennes, cf. lib/pdf-guards.ts). Compilé en CJS par
 * scripts/compile-pdf-template.mjs, chargé au RUNTIME par la route d'export.
 */

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { DocumentRapport } from '@/lib/rapport-render'
import { isNonEmptyText } from '@/lib/pdf-guards'

const C = { primary: '#4338CA', danger: '#DC2626', border: '#E5E7EB', muted: '#6B7280', headerBg: '#EEF2FF' }
const s = StyleSheet.create({
  page: { padding: 32, fontSize: 8, color: '#111827' },
  h1: { fontSize: 17, fontWeight: 'bold', color: C.primary, marginBottom: 2 },
  sub: { fontSize: 9, color: C.muted, marginBottom: 8 },
  intro: { fontSize: 9, marginBottom: 8, lineHeight: 1.4 },
  h2: { fontSize: 11, fontWeight: 'bold', marginTop: 12, marginBottom: 5 },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  kpi: { width: 120, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 6, marginRight: 6, marginBottom: 6 },
  kpiLabel: { fontSize: 7, color: C.muted },
  kpiValue: { fontSize: 13, fontWeight: 'bold' },
  thRow: { flexDirection: 'row', backgroundColor: C.headerBg, paddingVertical: 3 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 3 },
  th: { fontSize: 7, fontWeight: 'bold', paddingHorizontal: 3, flex: 1 },
  td: { fontSize: 7, paddingHorizontal: 3, flex: 1 },
  note: { fontSize: 8, color: '#92400E', marginBottom: 4 },
  empty: { fontSize: 8, color: C.muted, fontStyle: 'italic' },
  footer: { position: 'absolute', bottom: 16, left: 32, right: 32, fontSize: 7, color: C.muted, textAlign: 'center' },
})

const cell = (v: string) => (isNonEmptyText(v) ? v : '—')

function RapportEditionPDF({ doc, dateStr }: { doc: DocumentRapport; locale: string; dateStr: string }) {
  return (
    <Document title={doc.titre}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.h1}>{doc.titre}</Text>
        <Text style={s.sub}>{doc.sousTitre}</Text>
        {isNonEmptyText(doc.intro) ? <Text style={s.intro}>{String(doc.intro)}</Text> : null}
        {doc.sections.map((sec, i) => (
          <View key={`s${i}`}>
            <Text style={s.h2}>{sec.titre}</Text>
            {sec.kpis.length > 0 ? (
              <View style={s.kpiRow}>
                {sec.kpis.map((k, j) => (
                  <View key={`k${j}`} style={s.kpi}>
                    <Text style={s.kpiLabel}>{k.label}</Text>
                    <Text style={[s.kpiValue, k.alerte ? { color: C.danger } : {}]}>{cell(k.valeur)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {sec.tables.map((t, j) => (
              <View key={`t${j}`} style={{ marginBottom: 6 }}>
                {t.lignes.length === 0 ? <Text style={s.empty}>—</Text> : (
                  <View>
                    <View style={s.thRow} fixed>
                      {t.colonnes.map((c, k) => <Text key={`h${k}`} style={s.th}>{cell(c)}</Text>)}
                    </View>
                    {t.lignes.map((l, r) => (
                      <View key={`r${r}`} style={s.tr} wrap={false}>
                        {l.map((v, k) => <Text key={`c${r}-${k}`} style={s.td}>{cell(v)}</Text>)}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
            {sec.textes.map((x, j) => <Text key={`x${j}`} style={s.note}>{cell(x)}</Text>)}
          </View>
        ))}
        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `ACRA — ${doc.titre} — ${dateStr} — ${pageNumber}/${totalPages}`} />
      </Page>
    </Document>
  )
}

/** Rend le PDF de l'édition. Appelé au runtime depuis la route d'export. */
export function renderRapportEditionPDF(doc: DocumentRapport, locale: string, dateStr: string): Promise<Buffer> {
  return renderToBuffer(<RapportEditionPDF doc={doc} locale={locale} dateStr={dateStr} />)
}
