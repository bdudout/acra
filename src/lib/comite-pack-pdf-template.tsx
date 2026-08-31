/**
 * comite-pack-pdf-template.tsx — Dossier de comité (pack de gouvernance).
 *
 * ⚠️ Mêmes contraintes que pdf-template.tsx (aucun Fragment JSX ; jamais de chaîne
 * potentiellement vide comme enfant direct d'un <View> — cf. lib/pdf-guards.ts).
 * Compilé en CJS autonome par scripts/compile-pdf-template.mjs, chargé au RUNTIME.
 */

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { verdictGlobal, type ComitePack, type VerdictNiveau } from '@/lib/comite-pack'
import { formatNumber } from '@/lib/format'
import { HeatmapGrid } from '@/lib/pdf-heatmap'
import { isNonEmptyText } from '@/lib/pdf-guards'

// Libellé d'axe de la heatmap (compacte) — évite d'alourdir le type Strings.
const HEATMAP_AXIS: Record<string, string> = {
  fr: 'Vraisemblance × Gravité (1-5)', en: 'Likelihood × Severity (1-5)', de: 'Wahrscheinlichkeit × Schwere (1-5)',
  es: 'Probabilidad × Gravedad (1-5)', it: 'Probabilità × Gravità (1-5)',
}

const COLORS = {
  primary: '#4338CA', danger: '#DC2626', warn: '#EA580C', info: '#2563EB',
  border: '#E5E7EB', muted: '#6B7280', headerBg: '#EEF2FF', okBg: '#ECFDF5', ok: '#16A34A',
}

// Couleur du bandeau de verdict global (RAG) selon le niveau.
const VERDICT_COLOR: Record<VerdictNiveau, string> = {
  ELEVE: COLORS.danger, MODERE: COLORS.warn, MAITRISE: COLORS.ok,
}

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: '#111827' },
  h1: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, marginBottom: 4 },
  sub: { fontSize: 9, color: COLORS.muted, marginBottom: 12 },
  h2: { fontSize: 12, fontWeight: 'bold', marginTop: 14, marginBottom: 6 },
  hlBox: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, padding: 8, marginBottom: 8 },
  hlItem: { flexDirection: 'row', marginBottom: 2 },
  hlDot: { width: 7, fontSize: 10, fontWeight: 'bold' },
  hlText: { fontSize: 8 },
  okBox: { backgroundColor: COLORS.okBg, borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 4, padding: 8, marginBottom: 8 },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  kpi: { width: '25%', padding: 4 },
  kpiInner: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, padding: 6 },
  kpiLabel: { fontSize: 7, color: COLORS.muted, marginBottom: 2 },
  kpiValue: { fontSize: 13, fontWeight: 'bold' },
  verdictBox: { borderRadius: 4, padding: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'baseline' },
  verdictLabel: { fontSize: 14, fontWeight: 'bold', color: '#FFFFFF' },
  verdictSub: { fontSize: 8, color: '#FFFFFF', marginLeft: 8 },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 7, color: COLORS.muted, textAlign: 'center' },
})

type Dict = Record<string, string>
type Strings = {
  docTitle: string; comiteType: Dict; section: Dict; metric: Dict; highlight: Dict
  highlightsTitle: string; noAlert: string; generatedOn: string
  verdictTitle: string; verdict: Record<VerdictNiveau, string>; verdictAlertes: string
}

const COMMON_METRIC = {
  total: '', eleve: '', moyen: '', faible: '', nonCote: '', actionsTotal: '', avancement: '',
  actionsEnRetard: '', horsAppetit: '', dansAppetit: '', evalues: '', ouverts: '', perteNette: '',
  tauxConformite: '', anomalies: '', critiques: '', recosEnRetard: '', echues: '', sous30j: '',
  enAlerte: '', critique: '', majeurs: '',
}

const STRINGS: Record<string, Strings> = {
  fr: {
    docTitle: 'Dossier de comité',
    comiteType: { RISQUES: 'Comité des risques', CONFORMITE: 'Comité de conformité', INCIDENTS: 'Comité incidents & sécurité' },
    section: { risques: 'Cartographie des risques', appetit: 'Appétit au risque', incidents: 'Incidents & pertes', controles: 'Contrôle permanent', audit: 'Audit interne', regulateur: 'Suivi régulateur', kri: 'Indicateurs clés (KRI)', dora: 'Résilience TIC (DORA)' },
    metric: { ...COMMON_METRIC, total: 'Total', eleve: 'Élevés', moyen: 'Moyens', faible: 'Faibles', nonCote: 'Non cotés', actionsTotal: 'Actions', avancement: 'Avancement', actionsEnRetard: 'Actions en retard', horsAppetit: 'Hors appétit', dansAppetit: 'Dans l\'appétit', evalues: 'Évalués', ouverts: 'Ouverts', perteNette: 'Perte nette (€)', tauxConformite: 'Taux de conformité', anomalies: 'Anomalies', critiques: 'Constats critiques', recosEnRetard: 'Recos en retard', echues: 'Échéances dépassées', sous30j: 'Sous 30 jours', enAlerte: 'En alerte', critique: 'Critiques', majeurs: 'Incidents majeurs' },
    highlight: { horsAppetit: 'risque(s) hors appétit', actionsEnRetard: 'action(s) de traitement en retard', conformiteFaible: '% de conformité du contrôle permanent (sous le seuil)', constatsCritiques: 'constat(s) d\'audit critiques ouverts', regulateurEchu: 'recommandation(s) régulateur échue(s)', kriCritique: 'KRI en zone critique', doraMajeurs: 'incident(s) TIC majeur(s) (DORA)', incidentsOuverts: 'incident(s) opérationnel(s) ouvert(s)' },
    highlightsTitle: 'Points d\'attention', noAlert: 'Aucun point d\'alerte : les indicateurs des modules actifs sont dans les seuils.', generatedOn: 'Généré le',
    verdictTitle: 'Niveau de risque global', verdict: { ELEVE: 'ÉLEVÉ', MODERE: 'MODÉRÉ', MAITRISE: 'MAÎTRISÉ' }, verdictAlertes: 'point(s) d\'alerte',
  },
  en: {
    docTitle: 'Committee pack',
    comiteType: { RISQUES: 'Risk committee', CONFORMITE: 'Compliance committee', INCIDENTS: 'Incidents & security committee' },
    section: { risques: 'Risk map', appetit: 'Risk appetite', incidents: 'Incidents & losses', controles: 'Permanent control', audit: 'Internal audit', regulateur: 'Regulator tracking', kri: 'Key risk indicators (KRI)', dora: 'ICT resilience (DORA)' },
    metric: { ...COMMON_METRIC, total: 'Total', eleve: 'High', moyen: 'Medium', faible: 'Low', nonCote: 'Unrated', actionsTotal: 'Actions', avancement: 'Progress', actionsEnRetard: 'Overdue actions', horsAppetit: 'Outside appetite', dansAppetit: 'Within appetite', evalues: 'Evaluated', ouverts: 'Open', perteNette: 'Net loss (€)', tauxConformite: 'Compliance rate', anomalies: 'Anomalies', critiques: 'Critical findings', recosEnRetard: 'Overdue recs', echues: 'Overdue', sous30j: 'Within 30 days', enAlerte: 'In alert', critique: 'Critical', majeurs: 'Major incidents' },
    highlight: { horsAppetit: 'risk(s) outside appetite', actionsEnRetard: 'overdue treatment action(s)', conformiteFaible: '% permanent-control compliance (below threshold)', constatsCritiques: 'open critical audit finding(s)', regulateurEchu: 'overdue regulator recommendation(s)', kriCritique: 'KRI in critical zone', doraMajeurs: 'major ICT incident(s) (DORA)', incidentsOuverts: 'open operational incident(s)' },
    highlightsTitle: 'Points of attention', noAlert: 'No alert: active-module indicators are within thresholds.', generatedOn: 'Generated on',
    verdictTitle: 'Overall risk level', verdict: { ELEVE: 'HIGH', MODERE: 'MODERATE', MAITRISE: 'UNDER CONTROL' }, verdictAlertes: 'alert(s)',
  },
  de: {
    docTitle: 'Ausschussunterlage',
    comiteType: { RISQUES: 'Risikoausschuss', CONFORMITE: 'Compliance-Ausschuss', INCIDENTS: 'Vorfall- & Sicherheitsausschuss' },
    section: { risques: 'Risikokarte', appetit: 'Risikoappetit', incidents: 'Vorfälle & Verluste', controles: 'Permanente Kontrolle', audit: 'Interne Revision', regulateur: 'Aufsichtsverfolgung', kri: 'Schlüsselindikatoren (KRI)', dora: 'IKT-Resilienz (DORA)' },
    metric: { ...COMMON_METRIC, total: 'Gesamt', eleve: 'Hoch', moyen: 'Mittel', faible: 'Niedrig', nonCote: 'Unbewertet', actionsTotal: 'Maßnahmen', avancement: 'Fortschritt', actionsEnRetard: 'Überfällige Maßnahmen', horsAppetit: 'Außerhalb', dansAppetit: 'Innerhalb', evalues: 'Bewertet', ouverts: 'Offen', perteNette: 'Nettoverlust (€)', tauxConformite: 'Konformitätsgrad', anomalies: 'Anomalien', critiques: 'Kritische Feststellungen', recosEnRetard: 'Überfällige Empf.', echues: 'Überfällig', sous30j: 'Binnen 30 Tagen', enAlerte: 'In Alarm', critique: 'Kritisch', majeurs: 'Schwere Vorfälle' },
    highlight: { horsAppetit: 'Risiko(en) außerhalb des Appetits', actionsEnRetard: 'überfällige Behandlungsmaßnahme(n)', conformiteFaible: '% Konformität der permanenten Kontrolle (unter Schwelle)', constatsCritiques: 'offene kritische Revisionsfeststellung(en)', regulateurEchu: 'überfällige Aufsichtsempfehlung(en)', kriCritique: 'KRI in kritischer Zone', doraMajeurs: 'schwere(r) IKT-Vorfall/-Vorfälle (DORA)', incidentsOuverts: 'offene(r) operative(r) Vorfall/Vorfälle' },
    highlightsTitle: 'Aufmerksamkeitspunkte', noAlert: 'Kein Alarm: die Indikatoren der aktiven Module liegen innerhalb der Schwellen.', generatedOn: 'Erstellt am',
    verdictTitle: 'Gesamtrisikoniveau', verdict: { ELEVE: 'HOCH', MODERE: 'MITTEL', MAITRISE: 'BEHERRSCHT' }, verdictAlertes: 'Alarm(e)',
  },
  es: {
    docTitle: 'Expediente de comité',
    comiteType: { RISQUES: 'Comité de riesgos', CONFORMITE: 'Comité de cumplimiento', INCIDENTS: 'Comité de incidentes y seguridad' },
    section: { risques: 'Mapa de riesgos', appetit: 'Apetito de riesgo', incidents: 'Incidentes y pérdidas', controles: 'Control permanente', audit: 'Auditoría interna', regulateur: 'Seguimiento regulador', kri: 'Indicadores clave (KRI)', dora: 'Resiliencia TIC (DORA)' },
    metric: { ...COMMON_METRIC, total: 'Total', eleve: 'Altos', moyen: 'Medios', faible: 'Bajos', nonCote: 'Sin valorar', actionsTotal: 'Acciones', avancement: 'Avance', actionsEnRetard: 'Acciones atrasadas', horsAppetit: 'Fuera del apetito', dansAppetit: 'Dentro del apetito', evalues: 'Evaluados', ouverts: 'Abiertos', perteNette: 'Pérdida neta (€)', tauxConformite: 'Tasa de conformidad', anomalies: 'Anomalías', critiques: 'Hallazgos críticos', recosEnRetard: 'Recs atrasadas', echues: 'Vencidos', sous30j: 'En 30 días', enAlerte: 'En alerta', critique: 'Críticos', majeurs: 'Incidentes graves' },
    highlight: { horsAppetit: 'riesgo(s) fuera del apetito', actionsEnRetard: 'acción(es) de tratamiento atrasada(s)', conformiteFaible: '% de conformidad del control permanente (bajo el umbral)', constatsCritiques: 'hallazgo(s) de auditoría crítico(s) abierto(s)', regulateurEchu: 'recomendación(es) del regulador vencida(s)', kriCritique: 'KRI en zona crítica', doraMajeurs: 'incidente(s) TIC grave(s) (DORA)', incidentsOuverts: 'incidente(s) operativo(s) abierto(s)' },
    highlightsTitle: 'Puntos de atención', noAlert: 'Sin alertas: los indicadores de los módulos activos están dentro de los umbrales.', generatedOn: 'Generado el',
    verdictTitle: 'Nivel de riesgo global', verdict: { ELEVE: 'ALTO', MODERE: 'MODERADO', MAITRISE: 'CONTROLADO' }, verdictAlertes: 'alerta(s)',
  },
  it: {
    docTitle: 'Fascicolo di comitato',
    comiteType: { RISQUES: 'Comitato rischi', CONFORMITE: 'Comitato conformità', INCIDENTS: 'Comitato incidenti e sicurezza' },
    section: { risques: 'Mappatura dei rischi', appetit: 'Propensione al rischio', incidents: 'Incidenti e perdite', controles: 'Controllo permanente', audit: 'Audit interno', regulateur: 'Monitoraggio regolatore', kri: 'Indicatori chiave (KRI)', dora: 'Resilienza TIC (DORA)' },
    metric: { ...COMMON_METRIC, total: 'Totale', eleve: 'Alti', moyen: 'Medi', faible: 'Bassi', nonCote: 'Non valutati', actionsTotal: 'Azioni', avancement: 'Avanzamento', actionsEnRetard: 'Azioni in ritardo', horsAppetit: 'Fuori propensione', dansAppetit: 'Entro la propensione', evalues: 'Valutati', ouverts: 'Aperti', perteNette: 'Perdita netta (€)', tauxConformite: 'Tasso di conformità', anomalies: 'Anomalie', critiques: 'Rilievi critici', recosEnRetard: 'Racc. in ritardo', echues: 'Scaduti', sous30j: 'Entro 30 giorni', enAlerte: 'In allerta', critique: 'Critici', majeurs: 'Incidenti gravi' },
    highlight: { horsAppetit: 'rischio/i fuori propensione', actionsEnRetard: 'azione/i di trattamento in ritardo', conformiteFaible: '% conformità del controllo permanente (sotto soglia)', constatsCritiques: 'rilievo/i di audit critici aperti', regulateurEchu: 'raccomandazione/i del regolatore scaduta/e', kriCritique: 'KRI in zona critica', doraMajeurs: 'incidente/i TIC grave/i (DORA)', incidentsOuverts: 'incidente/i operativo/i aperto/i' },
    highlightsTitle: 'Punti di attenzione', noAlert: 'Nessuna allerta: gli indicatori dei moduli attivi sono entro le soglie.', generatedOn: 'Generato il',
    verdictTitle: 'Livello di rischio complessivo', verdict: { ELEVE: 'ALTO', MODERE: 'MODERATO', MAITRISE: 'SOTTO CONTROLLO' }, verdictAlertes: 'allerta/e',
  },
}

function ComitePackPDF({ pack, locale, orgNom, dateStr }: { pack: ComitePack; locale: string; orgNom: string; dateStr: string }) {
  const S = STRINGS[locale] ?? STRINGS.fr
  const hasHighlights = pack.highlights.length > 0
  const v = verdictGlobal(pack)
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{S.comiteType[pack.type] ?? S.docTitle}</Text>
        <View>
          <Text style={s.sub}>{isNonEmptyText(orgNom) ? `${orgNom} — ` : ''}{S.docTitle} — {dateStr}</Text>
        </View>

        {/* Verdict global (RAG) — l'essentiel en un coup d'œil */}
        <View style={[s.verdictBox, { backgroundColor: VERDICT_COLOR[v.niveau] }]}>
          <Text style={s.verdictLabel}>{`${S.verdictTitle} : ${S.verdict[v.niveau]}`}</Text>
          <Text style={s.verdictSub}>{`${v.alertes} ${S.verdictAlertes}`}</Text>
        </View>

        {/* Points d'attention */}
        <Text style={s.h2}>{S.highlightsTitle}</Text>
        {Boolean(hasHighlights) && (
          <View style={s.hlBox}>
            {pack.highlights.map((h, i) => (
              <View key={`h-${i}`} style={s.hlItem}>
                <Text style={[s.hlDot, { color: h.niveau === 'alerte' ? COLORS.danger : COLORS.info }]}>{'•'}</Text>
                <Text style={s.hlText}>{`${h.value} ${S.highlight[h.key] ?? h.key}`}</Text>
              </View>
            ))}
          </View>
        )}
        {Boolean(!hasHighlights) && (
          <View style={s.okBox}><Text style={[s.hlText, { color: COLORS.ok }]}>{S.noAlert}</Text></View>
        )}

        {/* Sections par module */}
        {pack.sections.map((sec, si) => (
          <View key={`s-${si}`} wrap={false}>
            <Text style={s.h2}>{S.section[sec.id] ?? sec.id}</Text>
            {sec.id === 'risques' && pack.heatmap ? (
              <View style={{ marginBottom: 6 }}>
                <HeatmapGrid grid={pack.heatmap} axisLabel={HEATMAP_AXIS[locale] ?? HEATMAP_AXIS.fr} cellWidth={26} cellHeight={18} />
              </View>
            ) : null}
            <View style={s.kpiRow}>
              {sec.metrics.map((mt, mi) => (
                <View key={`m-${si}-${mi}`} style={s.kpi}>
                  <View style={s.kpiInner}>
                    <Text style={s.kpiLabel}>{S.metric[mt.key] ?? mt.key}</Text>
                    <Text style={[s.kpiValue, mt.alerte ? { color: COLORS.danger } : mt.positif ? { color: COLORS.ok } : {}]}>
                      {mt.key === 'perteNette' && typeof mt.value === 'number' ? `${formatNumber(mt.value, locale).replace(/[\u202f\u00a0]/g, ' ')} €` : String(mt.value)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}

        <Text style={s.footer} fixed>{`ACRA — ${S.generatedOn} ${dateStr}`}</Text>
      </Page>
    </Document>
  )
}

/** Rend le PDF d'un dossier de comité. Appelé au runtime depuis la route d'export. */
export function renderComitePackPDF(pack: ComitePack, locale: string, orgNom: string, dateStr: string): Promise<Buffer> {
  return renderToBuffer(<ComitePackPDF pack={pack} locale={locale} orgNom={orgNom} dateStr={dateStr} />)
}
