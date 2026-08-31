/**
 * carto-pdf-template.tsx — Rapport PDF de la CARTOGRAPHIE des risques.
 *
 * ⚠️ Mêmes contraintes que pdf-template.tsx :
 *   • AUCUN Fragment JSX (regrouper via <View>) — sinon « React error #31 » ;
 *   • jamais de chaîne potentiellement vide comme enfant direct d'un <View>
 *     (cf. lib/pdf-guards.ts) : toujours coercer les gardes en booléen.
 * Compilé en CJS autonome par scripts/compile-pdf-template.mjs puis chargé au
 * RUNTIME par la route d'export (SWC casse le rendu react-pdf).
 */

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { CartoExportData } from '@/lib/carto-export'
import { HeatmapGrid } from '@/lib/pdf-heatmap'
import { isNonEmptyText } from '@/lib/pdf-guards'

const COLORS = {
  primary: '#4338CA',
  eleve: '#DC2626',
  moyen: '#D97706',
  faible: '#16A34A',
  nonCote: '#9CA3AF',
  border: '#E5E7EB',
  muted: '#6B7280',
  headerBg: '#EEF2FF',
}

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: '#111827' },
  h1: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, marginBottom: 4 },
  sub: { fontSize: 9, color: COLORS.muted, marginBottom: 14 },
  h2: { fontSize: 12, fontWeight: 'bold', marginTop: 14, marginBottom: 6 },
  kpiRow: { flexDirection: 'row', marginBottom: 10 },
  kpi: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, padding: 8, marginRight: 6 },
  kpiLabel: { fontSize: 7, color: COLORS.muted, marginBottom: 2 },
  kpiValue: { fontSize: 14, fontWeight: 'bold' },
  gridRow: { flexDirection: 'row' },
  axisCell: { width: 22, height: 26, alignItems: 'center', justifyContent: 'center' },
  axisText: { fontSize: 7, color: COLORS.muted },
  cell: { width: 46, height: 26, borderWidth: 1, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: 9, fontWeight: 'bold', color: '#FFFFFF' },
  axisLabel: { fontSize: 7, color: COLORS.muted, marginTop: 3, marginLeft: 22 },
  table: { marginTop: 4 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 3 },
  thRow: { flexDirection: 'row', backgroundColor: COLORS.headerBg, paddingVertical: 4 },
  th: { fontSize: 8, fontWeight: 'bold', paddingHorizontal: 4 },
  td: { fontSize: 8, paddingHorizontal: 4 },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 7, color: COLORS.muted, textAlign: 'center' },
})

type Strings = {
  title: string; subtitle: string; mode: string; inherent: string; residual: string
  total: string; eleve: string; moyen: string; faible: string; nonCote: string
  heatmap: string; gravite: string; vraisemblance: string
  byCategory: string; byProcess: string; byEntity: string
  colLabel: string; colCount: string; colMax: string; notSet: string; generatedOn: string
}

const STRINGS: Record<string, Strings> = {
  fr: { title: 'Cartographie des risques', subtitle: 'Synthèse du registre : heat map gravité × vraisemblance et ventilations', mode: 'Mode', inherent: 'Inhérent', residual: 'Résiduel', total: 'Risques', eleve: 'Élevés', moyen: 'Moyens', faible: 'Faibles', nonCote: 'Non cotés', heatmap: 'Heat map gravité × vraisemblance', gravite: 'Gravité', vraisemblance: 'Vraisemblance', byCategory: 'Ventilation par catégorie', byProcess: 'Ventilation par processus', byEntity: 'Ventilation par entité', colLabel: 'Libellé', colCount: 'Nombre', colMax: 'Niveau max', notSet: 'Non renseigné', generatedOn: 'Généré le' },
  en: { title: 'Risk map', subtitle: 'Register summary: severity × likelihood heat map and breakdowns', mode: 'Mode', inherent: 'Inherent', residual: 'Residual', total: 'Risks', eleve: 'High', moyen: 'Medium', faible: 'Low', nonCote: 'Unrated', heatmap: 'Severity × likelihood heat map', gravite: 'Severity', vraisemblance: 'Likelihood', byCategory: 'Breakdown by category', byProcess: 'Breakdown by process', byEntity: 'Breakdown by entity', colLabel: 'Label', colCount: 'Count', colMax: 'Max level', notSet: 'Not set', generatedOn: 'Generated on' },
  de: { title: 'Risikokarte', subtitle: 'Register-Übersicht: Heatmap Schwere × Wahrscheinlichkeit und Aufschlüsselungen', mode: 'Modus', inherent: 'Inhärent', residual: 'Residual', total: 'Risiken', eleve: 'Hoch', moyen: 'Mittel', faible: 'Niedrig', nonCote: 'Unbewertet', heatmap: 'Heatmap Schwere × Wahrscheinlichkeit', gravite: 'Schwere', vraisemblance: 'Wahrscheinlichkeit', byCategory: 'Aufschlüsselung nach Kategorie', byProcess: 'Aufschlüsselung nach Prozess', byEntity: 'Aufschlüsselung nach Einheit', colLabel: 'Bezeichnung', colCount: 'Anzahl', colMax: 'Max. Stufe', notSet: 'Nicht gesetzt', generatedOn: 'Erstellt am' },
  es: { title: 'Mapa de riesgos', subtitle: 'Resumen del registro: mapa de calor gravedad × probabilidad y desgloses', mode: 'Modo', inherent: 'Inherente', residual: 'Residual', total: 'Riesgos', eleve: 'Altos', moyen: 'Medios', faible: 'Bajos', nonCote: 'Sin valorar', heatmap: 'Mapa de calor gravedad × probabilidad', gravite: 'Gravedad', vraisemblance: 'Probabilidad', byCategory: 'Desglose por categoría', byProcess: 'Desglose por proceso', byEntity: 'Desglose por entidad', colLabel: 'Etiqueta', colCount: 'Cantidad', colMax: 'Nivel máx.', notSet: 'Sin indicar', generatedOn: 'Generado el' },
  it: { title: 'Mappatura dei rischi', subtitle: 'Sintesi del registro: heat map gravità × probabilità e ripartizioni', mode: 'Modalità', inherent: 'Inerente', residual: 'Residuo', total: 'Rischi', eleve: 'Alti', moyen: 'Medi', faible: 'Bassi', nonCote: 'Non valutati', heatmap: 'Heat map gravità × probabilità', gravite: 'Gravità', vraisemblance: 'Probabilità', byCategory: 'Ripartizione per categoria', byProcess: 'Ripartizione per processo', byEntity: 'Ripartizione per entità', colLabel: 'Etichetta', colCount: 'Numero', colMax: 'Livello max', notSet: 'Non indicato', generatedOn: 'Generato il' },
}

function Breakdown({ titre, rows, S }: { titre: string; rows: { key: string; label?: string | null; count: number; maxNiveau: number | null }[]; S: Strings }) {
  return (
    <View wrap={false}>
      <Text style={s.h2}>{titre}</Text>
      <View style={s.table}>
        <View style={s.thRow}>
          <Text style={[s.th, { width: 300 }]}>{S.colLabel}</Text>
          <Text style={[s.th, { width: 60, textAlign: 'right' }]}>{S.colCount}</Text>
          <Text style={[s.th, { width: 70, textAlign: 'right' }]}>{S.colMax}</Text>
        </View>
        {rows.map((r, i) => (
          <View key={`${r.key}-${i}`} style={s.tr}>
            <Text style={[s.td, { width: 300 }]}>
              {isNonEmptyText(r.label) ? String(r.label) : (isNonEmptyText(r.key) ? r.key : S.notSet)}
            </Text>
            <Text style={[s.td, { width: 60, textAlign: 'right' }]}>{String(r.count)}</Text>
            <Text style={[s.td, { width: 70, textAlign: 'right' }]}>{r.maxNiveau == null ? '—' : String(r.maxNiveau)}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function CartographiePDF({ data, locale, orgNom, dateStr }: { data: CartoExportData; locale: string; orgNom: string; dateStr: string }) {
  const S = STRINGS[locale] ?? STRINGS.fr
  const modeLabel = data.mode === 'inherent' ? S.inherent : S.residual
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{S.title}</Text>
        <View>
          <Text style={s.sub}>
            {isNonEmptyText(orgNom) ? `${orgNom} — ` : ''}{S.subtitle} ({S.mode} : {modeLabel})
          </Text>
        </View>

        {/* Synthèse */}
        <View style={s.kpiRow}>
          <View style={s.kpi}><Text style={s.kpiLabel}>{S.total}</Text><Text style={s.kpiValue}>{String(data.total)}</Text></View>
          <View style={s.kpi}><Text style={s.kpiLabel}>{S.eleve}</Text><Text style={[s.kpiValue, { color: COLORS.eleve }]}>{String(data.parBucket.eleve)}</Text></View>
          <View style={s.kpi}><Text style={s.kpiLabel}>{S.moyen}</Text><Text style={[s.kpiValue, { color: COLORS.moyen }]}>{String(data.parBucket.moyen)}</Text></View>
          <View style={s.kpi}><Text style={s.kpiLabel}>{S.faible}</Text><Text style={[s.kpiValue, { color: COLORS.faible }]}>{String(data.parBucket.faible)}</Text></View>
          <View style={s.kpi}><Text style={s.kpiLabel}>{S.nonCote}</Text><Text style={[s.kpiValue, { color: COLORS.nonCote }]}>{String(data.nonCotes)}</Text></View>
        </View>

        {/* Heat map */}
        <View wrap={false}>
          <Text style={s.h2}>{S.heatmap}</Text>
          <HeatmapGrid grid={data.grid} axisLabel={`${S.vraisemblance} (1-5) - ${S.gravite} (1-5)`} />
        </View>

        <Breakdown titre={S.byCategory} rows={data.parCategorie} S={S} />
        <Breakdown titre={S.byProcess} rows={data.parProcessus} S={S} />
        <Breakdown titre={S.byEntity} rows={data.parEntite} S={S} />

        <Text style={s.footer} fixed>{`ACRA — ${S.generatedOn} ${dateStr}`}</Text>
      </Page>
    </Document>
  )
}

/** Rend le PDF de cartographie. Appelé au runtime depuis la route d'export. */
export function renderCartographiePDF(data: CartoExportData, locale: string, orgNom: string, dateStr: string): Promise<Buffer> {
  return renderToBuffer(<CartographiePDF data={data} locale={locale} orgNom={orgNom} dateStr={dateStr} />)
}
