/**
 * soa-pdf-template.tsx — Déclaration d'applicabilité (Statement of Applicability).
 *
 * ⚠️ Mêmes contraintes que pdf-template.tsx (aucun Fragment JSX ; jamais de chaîne
 * potentiellement vide comme enfant direct d'un <View> — cf. lib/pdf-guards.ts).
 * Compilé en CJS autonome par scripts/compile-pdf-template.mjs, chargé au RUNTIME.
 */

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { SoaExportData } from '@/lib/soa-export'
import { isNonEmptyText } from '@/lib/pdf-guards'

const COLORS = {
  primary: '#4338CA',
  conforme: '#16A34A',
  partiel: '#D97706',
  nonConforme: '#DC2626',
  na: '#6B7280',
  nonEvalue: '#9CA3AF',
  border: '#E5E7EB',
  muted: '#6B7280',
  headerBg: '#EEF2FF',
}

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 8, color: '#111827' },
  h1: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, marginBottom: 4 },
  sub: { fontSize: 9, color: COLORS.muted, marginBottom: 12 },
  kpiRow: { flexDirection: 'row', marginBottom: 10 },
  kpi: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, padding: 6, marginRight: 6 },
  kpiLabel: { fontSize: 7, color: COLORS.muted, marginBottom: 2 },
  kpiValue: { fontSize: 13, fontWeight: 'bold' },
  cat: { fontSize: 11, fontWeight: 'bold', marginTop: 12, marginBottom: 4, color: COLORS.primary },
  thRow: { flexDirection: 'row', backgroundColor: COLORS.headerBg, paddingVertical: 3 },
  th: { fontSize: 7, fontWeight: 'bold', paddingHorizontal: 3 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 2 },
  td: { fontSize: 7, paddingHorizontal: 3 },
  badge: { fontSize: 7, fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 7, color: COLORS.muted, textAlign: 'center' },
})

type Strings = {
  title: string; subtitle: string
  rate: string; evaluated: string; controls: string; uncategorized: string
  colRef: string; colControl: string; colStatus: string; colComment: string
  conforme: string; partiel: string; non_conforme: string; na: string; nonEvalue: string
  generatedOn: string; approval: string
}

const STRINGS: Record<string, Strings> = {
  fr: { title: 'Déclaration d\'applicabilité', subtitle: 'Statement of Applicability (SoA)', rate: 'Taux de conformité', evaluated: 'Évalués', controls: 'Contrôles', uncategorized: 'Sans catégorie', colRef: 'Réf.', colControl: 'Contrôle', colStatus: 'Statut', colComment: 'Justification / commentaire', conforme: 'Conforme', partiel: 'Partiel', non_conforme: 'Non conforme', na: 'N/A', nonEvalue: 'Non évalué', generatedOn: 'Généré le', approval: 'Approuvé par : ____________________   Date : __________' },
  en: { title: 'Statement of Applicability', subtitle: 'SoA', rate: 'Compliance rate', evaluated: 'Evaluated', controls: 'Controls', uncategorized: 'Uncategorized', colRef: 'Ref.', colControl: 'Control', colStatus: 'Status', colComment: 'Justification / comment', conforme: 'Compliant', partiel: 'Partial', non_conforme: 'Non-compliant', na: 'N/A', nonEvalue: 'Not evaluated', generatedOn: 'Generated on', approval: 'Approved by: ____________________   Date: __________' },
  de: { title: 'Anwendbarkeitserklärung', subtitle: 'Statement of Applicability (SoA)', rate: 'Konformitätsgrad', evaluated: 'Bewertet', controls: 'Kontrollen', uncategorized: 'Ohne Kategorie', colRef: 'Ref.', colControl: 'Kontrolle', colStatus: 'Status', colComment: 'Begründung / Kommentar', conforme: 'Konform', partiel: 'Teilweise', non_conforme: 'Nicht konform', na: 'N/A', nonEvalue: 'Nicht bewertet', generatedOn: 'Erstellt am', approval: 'Genehmigt von: ____________________   Datum: __________' },
  es: { title: 'Declaración de aplicabilidad', subtitle: 'Statement of Applicability (SoA)', rate: 'Tasa de conformidad', evaluated: 'Evaluados', controls: 'Controles', uncategorized: 'Sin categoría', colRef: 'Ref.', colControl: 'Control', colStatus: 'Estado', colComment: 'Justificación / comentario', conforme: 'Conforme', partiel: 'Parcial', non_conforme: 'No conforme', na: 'N/A', nonEvalue: 'Sin evaluar', generatedOn: 'Generado el', approval: 'Aprobado por: ____________________   Fecha: __________' },
  it: { title: 'Dichiarazione di applicabilità', subtitle: 'Statement of Applicability (SoA)', rate: 'Tasso di conformità', evaluated: 'Valutati', controls: 'Controlli', uncategorized: 'Senza categoria', colRef: 'Rif.', colControl: 'Controllo', colStatus: 'Stato', colComment: 'Giustificazione / commento', conforme: 'Conforme', partiel: 'Parziale', non_conforme: 'Non conforme', na: 'N/A', nonEvalue: 'Non valutato', generatedOn: 'Generato il', approval: 'Approvato da: ____________________   Data: __________' },
}

function statutLabel(statut: string | null, S: Strings): string {
  if (statut === 'conforme') return S.conforme
  if (statut === 'partiel') return S.partiel
  if (statut === 'non_conforme') return S.non_conforme
  if (statut === 'na') return S.na
  return S.nonEvalue
}
function statutColor(statut: string | null): string {
  if (statut === 'conforme') return COLORS.conforme
  if (statut === 'partiel') return COLORS.partiel
  if (statut === 'non_conforme') return COLORS.nonConforme
  if (statut === 'na') return COLORS.na
  return COLORS.nonEvalue
}

function SoaPDF({ data, stats, locale, orgNom, frameworkNom, dateStr }: {
  data: SoaExportData
  stats: { tauxConformite: number; evalues: number; total: number }
  locale: string; orgNom: string; frameworkNom: string; dateStr: string
}) {
  const S = STRINGS[locale] ?? STRINGS.fr
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{S.title}</Text>
        <View>
          <Text style={s.sub}>
            {isNonEmptyText(orgNom) ? `${orgNom} — ` : ''}{isNonEmptyText(frameworkNom) ? `${frameworkNom} — ` : ''}{S.subtitle}
          </Text>
        </View>

        <View style={s.kpiRow}>
          <View style={s.kpi}><Text style={s.kpiLabel}>{S.rate}</Text><Text style={[s.kpiValue, { color: stats.tauxConformite >= 80 ? COLORS.conforme : COLORS.partiel }]}>{`${stats.tauxConformite}%`}</Text></View>
          <View style={s.kpi}><Text style={s.kpiLabel}>{S.evaluated}</Text><Text style={s.kpiValue}>{`${stats.evalues}/${stats.total}`}</Text></View>
          <View style={s.kpi}><Text style={s.kpiLabel}>{S.conforme}</Text><Text style={[s.kpiValue, { color: COLORS.conforme }]}>{String(data.parStatut.conforme)}</Text></View>
          <View style={s.kpi}><Text style={s.kpiLabel}>{S.non_conforme}</Text><Text style={[s.kpiValue, { color: COLORS.nonConforme }]}>{String(data.parStatut.nonConforme)}</Text></View>
          <View style={s.kpi}><Text style={s.kpiLabel}>{S.nonEvalue}</Text><Text style={[s.kpiValue, { color: COLORS.nonEvalue }]}>{String(data.parStatut.nonEvalue)}</Text></View>
        </View>

        {data.groupes.map((g, gi) => (
          <View key={`g-${gi}`}>
            <Text style={s.cat}>{isNonEmptyText(g.categorie) ? String(g.categorie) : S.uncategorized}</Text>
            <View wrap={false}>
              <View style={s.thRow}>
                <Text style={[s.th, { width: 48 }]}>{S.colRef}</Text>
                <Text style={[s.th, { width: 190 }]}>{S.colControl}</Text>
                <Text style={[s.th, { width: 70 }]}>{S.colStatus}</Text>
                <Text style={[s.th, { width: 215 }]}>{S.colComment}</Text>
              </View>
            </View>
            {g.lignes.map((l, li) => (
              <View key={`l-${gi}-${li}`} style={s.tr} wrap={false}>
                <Text style={[s.td, { width: 48 }]}>{isNonEmptyText(l.ref) ? l.ref : '—'}</Text>
                <Text style={[s.td, { width: 190 }]}>{isNonEmptyText(l.nom) ? l.nom : '—'}</Text>
                <Text style={[s.td, s.badge, { width: 70, color: statutColor(l.statut) }]}>{statutLabel(l.statut, S)}</Text>
                <Text style={[s.td, { width: 215 }]}>{isNonEmptyText(l.commentaire) ? String(l.commentaire) : ''}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 8, color: COLORS.muted }}>{S.approval}</Text>
        </View>

        <Text style={s.footer} fixed>{`ACRA — ${S.generatedOn} ${dateStr}`}</Text>
      </Page>
    </Document>
  )
}

/** Rend le PDF de la SoA. Appelé au runtime depuis la route d'export. */
export function renderSoaPDF(
  data: SoaExportData,
  stats: { tauxConformite: number; evalues: number; total: number },
  locale: string, orgNom: string, frameworkNom: string, dateStr: string,
): Promise<Buffer> {
  return renderToBuffer(<SoaPDF data={data} stats={stats} locale={locale} orgNom={orgNom} frameworkNom={frameworkNom} dateStr={dateStr} />)
}
