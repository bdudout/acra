/**
 * rapport-controle-interne-pdf-template.tsx — Rapport annuel de contrôle interne.
 *
 * ⚠️ Mêmes contraintes que pdf-template.tsx (aucun Fragment JSX ; jamais de chaîne
 * potentiellement vide comme enfant direct d'un <View> — cf. lib/pdf-guards.ts).
 * Compilé en CJS autonome par scripts/compile-pdf-template.mjs, chargé au RUNTIME.
 */

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { RapportControleInterne, LigneDefense } from '@/lib/rapport-controle-interne'
import { isNonEmptyText } from '@/lib/pdf-guards'

const COLORS = {
  primary: '#4338CA', danger: '#DC2626', info: '#2563EB', ok: '#16A34A', warn: '#D97706',
  border: '#E5E7EB', muted: '#6B7280', headerBg: '#EEF2FF', okBg: '#ECFDF5',
}

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: '#111827' },
  h1: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, marginBottom: 4 },
  sub: { fontSize: 9, color: COLORS.muted, marginBottom: 10 },
  intro: { fontSize: 8.5, color: '#374151', marginBottom: 10, lineHeight: 1.4 },
  appBox: { borderWidth: 1, borderRadius: 4, padding: 10, marginBottom: 10 },
  appLabel: { fontSize: 8, color: COLORS.muted },
  appValue: { fontSize: 15, fontWeight: 'bold' },
  h2: { fontSize: 12, fontWeight: 'bold', marginTop: 12, marginBottom: 5, color: COLORS.primary },
  h3: { fontSize: 10, fontWeight: 'bold', marginTop: 8, marginBottom: 3 },
  hlBox: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, padding: 8, marginBottom: 8 },
  hlItem: { flexDirection: 'row', marginBottom: 2 },
  hlDot: { width: 7, fontSize: 10, fontWeight: 'bold' },
  hlText: { fontSize: 8 },
  okBox: { backgroundColor: COLORS.okBg, borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 4, padding: 8, marginBottom: 8 },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 2 },
  kpi: { width: '25%', padding: 3 },
  kpiInner: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, padding: 5 },
  kpiLabel: { fontSize: 7, color: COLORS.muted, marginBottom: 2 },
  kpiValue: { fontSize: 12, fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 7, color: COLORS.muted, textAlign: 'center' },
})

type Dict = Record<string, string>
type Strings = {
  title: string; subtitle: string; intro: string
  ligne: Record<LigneDefense, string>
  appreciationLabel: string; appreciation: Dict
  section: Dict; metric: Dict; highlight: Dict
  highlightsTitle: string; noAlert: string; generatedOn: string; approval: string; year: string
}

const SECTION_FR = { risques: 'Cartographie des risques', appetit: 'Appétit au risque', incidents: 'Incidents & pertes', controles: 'Contrôle permanent', audit: 'Audit interne', regulateur: 'Suivi régulateur', kri: 'Indicateurs clés (KRI)', dora: 'Résilience opérationnelle TIC (DORA)' }
const METRIC_FR = { total: 'Total', eleve: 'Élevés', moyen: 'Moyens', faible: 'Faibles', nonCote: 'Non cotés', actionsTotal: 'Actions', avancement: 'Avancement', actionsEnRetard: 'Actions en retard', horsAppetit: 'Hors appétit', dansAppetit: 'Dans l\'appétit', evalues: 'Évalués', ouverts: 'Ouverts', perteNette: 'Perte nette (€)', tauxConformite: 'Taux de conformité', anomalies: 'Anomalies', critiques: 'Constats critiques', recosEnRetard: 'Recos en retard', echues: 'Échéances dépassées', sous30j: 'Sous 30 jours', enAlerte: 'En alerte', critique: 'Critiques', majeurs: 'Incidents majeurs' }
const HL_FR = { horsAppetit: 'risque(s) hors appétit', actionsEnRetard: 'action(s) de traitement en retard', conformiteFaible: '% de conformité du contrôle permanent (sous le seuil)', constatsCritiques: 'constat(s) d\'audit critiques ouverts', regulateurEchu: 'recommandation(s) régulateur échue(s)', kriCritique: 'KRI en zone critique', doraMajeurs: 'incident(s) TIC majeur(s) (DORA)', incidentsOuverts: 'incident(s) opérationnel(s) ouvert(s)' }

const SECTION_EN = { risques: 'Risk map', appetit: 'Risk appetite', incidents: 'Incidents & losses', controles: 'Permanent control', audit: 'Internal audit', regulateur: 'Regulator tracking', kri: 'Key risk indicators (KRI)', dora: 'ICT operational resilience (DORA)' }
const METRIC_EN = { total: 'Total', eleve: 'High', moyen: 'Medium', faible: 'Low', nonCote: 'Unrated', actionsTotal: 'Actions', avancement: 'Progress', actionsEnRetard: 'Overdue actions', horsAppetit: 'Outside appetite', dansAppetit: 'Within appetite', evalues: 'Evaluated', ouverts: 'Open', perteNette: 'Net loss (€)', tauxConformite: 'Compliance rate', anomalies: 'Anomalies', critiques: 'Critical findings', recosEnRetard: 'Overdue recs', echues: 'Overdue', sous30j: 'Within 30 days', enAlerte: 'In alert', critique: 'Critical', majeurs: 'Major incidents' }
const HL_EN = { horsAppetit: 'risk(s) outside appetite', actionsEnRetard: 'overdue treatment action(s)', conformiteFaible: '% permanent-control compliance (below threshold)', constatsCritiques: 'open critical audit finding(s)', regulateurEchu: 'overdue regulator recommendation(s)', kriCritique: 'KRI in critical zone', doraMajeurs: 'major ICT incident(s) (DORA)', incidentsOuverts: 'open operational incident(s)' }

const STRINGS: Record<string, Strings> = {
  fr: {
    title: 'Rapport annuel de contrôle interne', subtitle: 'Dispositif de maîtrise des risques — synthèse',
    intro: 'Ce rapport présente l\'état du dispositif de contrôle interne selon le modèle des trois lignes de défense (contrôle permanent de 1ᵉʳ niveau, gestion des risques et conformité de 2ᵉ niveau, audit interne de 3ᵉ niveau), complété d\'un volet de résilience opérationnelle TIC (DORA). Il consolide les indicateurs des modules actifs et formule une appréciation d\'ensemble.',
    ligne: { '1': '1ʳᵉ ligne de défense — Contrôle permanent (opérationnel)', '2': '2ᵉ ligne de défense — Gestion des risques & conformité', '3': '3ᵉ ligne de défense — Audit interne', TIC: 'Résilience opérationnelle numérique (DORA)' },
    appreciationLabel: 'Appréciation globale du dispositif', appreciation: { SATISFAISANT: 'Satisfaisant', A_RENFORCER: 'À renforcer', INSUFFISANT: 'Insuffisant' },
    section: SECTION_FR, metric: METRIC_FR, highlight: HL_FR,
    highlightsTitle: 'Points d\'attention', noAlert: 'Aucun point d\'alerte : les indicateurs des modules actifs sont dans les seuils.', generatedOn: 'Généré le', approval: 'Approuvé par l\'organe de surveillance : ____________________   Date : __________', year: 'Exercice',
  },
  en: {
    title: 'Annual internal control report', subtitle: 'Risk management framework — summary',
    intro: 'This report sets out the state of the internal control framework along the three-lines-of-defence model (first-line permanent control, second-line risk management and compliance, third-line internal audit), complemented by an ICT operational resilience section (DORA). It consolidates active-module indicators and states an overall assessment.',
    ligne: { '1': '1st line of defence — Permanent control (operational)', '2': '2nd line of defence — Risk management & compliance', '3': '3rd line of defence — Internal audit', TIC: 'Digital operational resilience (DORA)' },
    appreciationLabel: 'Overall assessment of the framework', appreciation: { SATISFAISANT: 'Satisfactory', A_RENFORCER: 'To be strengthened', INSUFFISANT: 'Insufficient' },
    section: SECTION_EN, metric: METRIC_EN, highlight: HL_EN,
    highlightsTitle: 'Points of attention', noAlert: 'No alert: active-module indicators are within thresholds.', generatedOn: 'Generated on', approval: 'Approved by the supervisory body: ____________________   Date: __________', year: 'Financial year',
  },
  de: {
    title: 'Jährlicher Bericht über die interne Kontrolle', subtitle: 'Risikomanagement-Rahmenwerk — Zusammenfassung',
    intro: 'Dieser Bericht stellt den Zustand des internen Kontrollsystems nach dem Modell der drei Verteidigungslinien dar (permanente Kontrolle der 1. Ebene, Risikomanagement und Compliance der 2. Ebene, interne Revision der 3. Ebene), ergänzt um einen Abschnitt zur digitalen operationellen Resilienz (DORA).',
    ligne: { '1': '1. Verteidigungslinie — Permanente Kontrolle (operativ)', '2': '2. Verteidigungslinie — Risikomanagement & Compliance', '3': '3. Verteidigungslinie — Interne Revision', TIC: 'Digitale operationelle Resilienz (DORA)' },
    appreciationLabel: 'Gesamtbeurteilung des Systems', appreciation: { SATISFAISANT: 'Zufriedenstellend', A_RENFORCER: 'Zu stärken', INSUFFISANT: 'Unzureichend' },
    section: SECTION_EN, metric: METRIC_EN, highlight: HL_EN,
    highlightsTitle: 'Aufmerksamkeitspunkte', noAlert: 'Kein Alarm: die Indikatoren der aktiven Module liegen innerhalb der Schwellen.', generatedOn: 'Erstellt am', approval: 'Vom Aufsichtsorgan genehmigt: ____________________   Datum: __________', year: 'Geschäftsjahr',
  },
  es: {
    title: 'Informe anual de control interno', subtitle: 'Marco de gestión de riesgos — resumen',
    intro: 'Este informe presenta el estado del marco de control interno según el modelo de las tres líneas de defensa (control permanente de 1ª línea, gestión de riesgos y cumplimiento de 2ª línea, auditoría interna de 3ª línea), completado con un apartado de resiliencia operativa TIC (DORA).',
    ligne: { '1': '1ª línea de defensa — Control permanente (operativo)', '2': '2ª línea de defensa — Gestión de riesgos y cumplimiento', '3': '3ª línea de defensa — Auditoría interna', TIC: 'Resiliencia operativa digital (DORA)' },
    appreciationLabel: 'Valoración global del dispositivo', appreciation: { SATISFAISANT: 'Satisfactorio', A_RENFORCER: 'A reforzar', INSUFFISANT: 'Insuficiente' },
    section: SECTION_EN, metric: METRIC_EN, highlight: HL_EN,
    highlightsTitle: 'Puntos de atención', noAlert: 'Sin alertas: los indicadores de los módulos activos están dentro de los umbrales.', generatedOn: 'Generado el', approval: 'Aprobado por el órgano de supervisión: ____________________   Fecha: __________', year: 'Ejercicio',
  },
  it: {
    title: 'Relazione annuale sul controllo interno', subtitle: 'Sistema di gestione dei rischi — sintesi',
    intro: 'La presente relazione illustra lo stato del sistema di controllo interno secondo il modello delle tre linee di difesa (controllo permanente di 1ª linea, gestione dei rischi e conformità di 2ª linea, audit interno di 3ª linea), integrato da una sezione sulla resilienza operativa TIC (DORA).',
    ligne: { '1': '1ª linea di difesa — Controllo permanente (operativo)', '2': '2ª linea di difesa — Gestione dei rischi e conformità', '3': '3ª linea di difesa — Audit interno', TIC: 'Resilienza operativa digitale (DORA)' },
    appreciationLabel: 'Valutazione complessiva del dispositivo', appreciation: { SATISFAISANT: 'Soddisfacente', A_RENFORCER: 'Da rafforzare', INSUFFISANT: 'Insufficiente' },
    section: SECTION_EN, metric: METRIC_EN, highlight: HL_EN,
    highlightsTitle: 'Punti di attenzione', noAlert: 'Nessuna allerta: gli indicatori dei moduli attivi sono entro le soglie.', generatedOn: 'Generato il', approval: 'Approvato dall\'organo di vigilanza: ____________________   Data: __________', year: 'Esercizio',
  },
}

function appColor(a: string): { bg: string; border: string; fg: string } {
  if (a === 'SATISFAISANT') return { bg: COLORS.okBg, border: '#A7F3D0', fg: COLORS.ok }
  if (a === 'A_RENFORCER') return { bg: '#FFFBEB', border: '#FDE68A', fg: COLORS.warn }
  return { bg: '#FEF2F2', border: '#FECACA', fg: COLORS.danger }
}

function RapportPDF({ rapport, locale, orgNom, annee, dateStr }: { rapport: RapportControleInterne; locale: string; orgNom: string; annee: string; dateStr: string }) {
  const S = STRINGS[locale] ?? STRINGS.fr
  const hasHighlights = rapport.highlights.length > 0
  const app = appColor(rapport.appreciation)
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{S.title}</Text>
        <View>
          <Text style={s.sub}>{isNonEmptyText(orgNom) ? `${orgNom} — ` : ''}{S.subtitle}{isNonEmptyText(annee) ? ` — ${S.year} ${annee}` : ''}</Text>
        </View>

        <Text style={s.intro}>{S.intro}</Text>

        {/* Appréciation globale */}
        <View style={[s.appBox, { backgroundColor: app.bg, borderColor: app.border }]}>
          <Text style={s.appLabel}>{S.appreciationLabel}</Text>
          <Text style={[s.appValue, { color: app.fg }]}>{S.appreciation[rapport.appreciation] ?? rapport.appreciation}</Text>
        </View>

        {/* Points d'attention */}
        <Text style={s.h2}>{S.highlightsTitle}</Text>
        {Boolean(hasHighlights) && (
          <View style={s.hlBox}>
            {rapport.highlights.map((h, i) => (
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

        {/* Groupes par ligne de défense */}
        {rapport.groupes.map((g, gi) => (
          <View key={`g-${gi}`}>
            <Text style={s.h2}>{S.ligne[g.ligne] ?? g.ligne}</Text>
            {g.sections.map((sec, si) => (
              <View key={`s-${gi}-${si}`} wrap={false}>
                <Text style={s.h3}>{S.section[sec.id] ?? sec.id}</Text>
                <View style={s.kpiRow}>
                  {sec.metrics.map((mt, mi) => (
                    <View key={`m-${gi}-${si}-${mi}`} style={s.kpi}>
                      <View style={s.kpiInner}>
                        <Text style={s.kpiLabel}>{S.metric[mt.key] ?? mt.key}</Text>
                        <Text style={[s.kpiValue, mt.alerte ? { color: COLORS.danger } : {}]}>{String(mt.value)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
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

/** Rend le PDF du rapport annuel de contrôle interne. Appelé au runtime. */
export function renderRapportControleInternePDF(rapport: RapportControleInterne, locale: string, orgNom: string, annee: string, dateStr: string): Promise<Buffer> {
  return renderToBuffer(<RapportPDF rapport={rapport} locale={locale} orgNom={orgNom} annee={annee} dateStr={dateStr} />)
}
