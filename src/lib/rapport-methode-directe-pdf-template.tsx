/**
 * rapport-methode-directe-pdf-template.tsx — Rapport d'appréciation des risques
 * pour les méthodes à saisie directe (ISO/IEC 27005:2022, ISO 31000:2018,
 * NIST SP 800-30 Rev. 1). P4 de l'audit des méthodes.
 *
 * ⚠️ Mêmes contraintes que pdf-template.tsx :
 *   • AUCUN Fragment JSX (regrouper via <View>) — sinon « React error #31 » ;
 *   • jamais de chaîne potentiellement vide comme enfant direct d'un <View>
 *     (cf. lib/pdf-guards.ts) : toujours coercer les gardes en booléen.
 * Compilé en CJS autonome par scripts/compile-pdf-template.mjs puis chargé au
 * RUNTIME par la route d'export (SWC casse le rendu react-pdf).
 */

import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { reportStrings, criterionText, type DirectReport } from '@/lib/rapport-methode-directe'
import { isNonEmptyText } from '@/lib/pdf-guards'

const C = { primary: '#4338CA', danger: '#DC2626', ok: '#16A34A', border: '#E5E7EB', muted: '#6B7280', headerBg: '#EEF2FF' }

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 8, color: '#111827' },
  h1: { fontSize: 17, fontWeight: 'bold', color: C.primary, marginBottom: 2 },
  sub: { fontSize: 9, color: C.muted, marginBottom: 10 },
  h2: { fontSize: 11, fontWeight: 'bold', marginTop: 12, marginBottom: 5 },
  note: { fontSize: 8, color: '#374151', marginBottom: 6, lineHeight: 1.4 },
  label: { fontSize: 7, color: C.muted },
  value: { fontSize: 9, marginBottom: 4 },
  kpiRow: { flexDirection: 'row', marginBottom: 6 },
  kpi: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 6, marginRight: 5 },
  kpiValue: { fontSize: 13, fontWeight: 'bold' },
  thRow: { flexDirection: 'row', backgroundColor: C.headerBg, paddingVertical: 3 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 3 },
  th: { fontSize: 7, fontWeight: 'bold', paddingHorizontal: 3 },
  td: { fontSize: 7, paddingHorizontal: 3 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 3, marginTop: 1 },
  empty: { fontSize: 8, color: C.muted, fontStyle: 'italic' },
  footer: { position: 'absolute', bottom: 16, left: 32, right: 32, fontSize: 7, color: C.muted, textAlign: 'center' },
})

const hex = (c: string) => (/^#?[0-9a-fA-F]{6}$/.test(c) ? (c.startsWith('#') ? c : `#${c}`) : '#9CA3AF')
const lvl = (l: { gravite: number; vraisemblance: number; niveau: number }) => `${l.gravite}×${l.vraisemblance}=${l.niveau}`
const txt = (v: string | null | undefined) => (isNonEmptyText(v) ? String(v) : '—')

/** Tableau générique : largeurs fixes, en-tête répété sur chaque page. */
function Table({ cols, rows }: { cols: { label: string; width: number }[]; rows: string[][] }) {
  return (
    <View>
      <View style={s.thRow} fixed>
        {cols.map((c, i) => <Text key={`h${i}`} style={[s.th, { width: c.width }]}>{c.label}</Text>)}
      </View>
      {rows.map((r, i) => (
        <View key={`r${i}`} style={s.tr} wrap={false}>
          {r.map((cell, j) => <Text key={`c${i}-${j}`} style={[s.td, { width: cols[j].width }]}>{txt(cell)}</Text>)}
        </View>
      ))}
    </View>
  )
}

function DirectReportPDF({ report, locale, dateStr }: { report: DirectReport; locale: string; dateStr: string }) {
  const S = reportStrings(locale)
  const sy = report.synthese
  return (
    <Document title={`${S.reportTitle} — ${report.titre}`}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.h1}>{S.reportTitle}</Text>
        <Text style={s.sub}>{`${report.titre} — ${S.method} : ${report.standard}`}</Text>

        {/* Contexte */}
        <Text style={s.h2}>{S.context}</Text>
        <Text style={s.label}>{S.scope}</Text>
        <Text style={s.value}>{isNonEmptyText(report.contexte.perimetre) ? String(report.contexte.perimetre) : S.notProvided}</Text>
        <Text style={s.label}>{S.objectives}</Text>
        <Text style={s.value}>{isNonEmptyText(report.contexte.objectifs) ? String(report.contexte.objectifs) : S.notProvided}</Text>

        {/* Synthèse */}
        <Text style={s.h2}>{S.summary}</Text>
        <View style={s.kpiRow}>
          <View style={s.kpi}><Text style={s.label}>{S.total}</Text><Text style={s.kpiValue}>{String(sy.total)}</Text></View>
          <View style={s.kpi}><Text style={s.label}>{S.toTreat}</Text><Text style={[s.kpiValue, { color: sy.aTraiter > 0 ? C.danger : C.ok }]}>{String(sy.aTraiter)}</Text></View>
          <View style={s.kpi}><Text style={s.label}>{S.acceptable}</Text><Text style={s.kpiValue}>{String(sy.acceptables)}</Text></View>
          <View style={s.kpi}><Text style={s.label}>{S.noOwner}</Text><Text style={[s.kpiValue, sy.sansProprietaire > 0 ? { color: C.danger } : {}]}>{String(sy.sansProprietaire)}</Text></View>
          <View style={s.kpi}><Text style={s.label}>{S.measures}</Text><Text style={s.kpiValue}>{String(sy.mesures)}</Text></View>
          <View style={s.kpi}><Text style={s.label}>{S.plans}</Text><Text style={s.kpiValue}>{String(sy.plans)}</Text></View>
        </View>
        <Text style={s.label}>{S.byBand}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 3 }}>
          {sy.parPalier.map((p, i) => (
            <View key={`p${i}`} style={{ flexDirection: 'row', marginRight: 12 }}>
              <View style={[s.dot, { backgroundColor: hex(p.couleur) }]} />
              <Text style={s.td}>{`${p.label} : ${p.count}`}</Text>
            </View>
          ))}
        </View>
        <Text style={[s.note, { marginTop: 6 }]}>{S.evalNote}</Text>

        {/* Registre */}
        <Text style={s.h2} break={report.registre.length > 6}>{S.register}</Text>
        {Boolean(report.registre.length > 0) && (
          <Table
            cols={[
              { label: S.colRef, width: 28 }, { label: S.colRisk, width: 170 }, { label: S.colOwner, width: 90 },
              { label: S.colInherent, width: 50 }, { label: S.colCurrent, width: 50 }, { label: S.colResidual, width: 50 },
              { label: S.colBand, width: 62 }, { label: S.colDecision, width: 56 }, { label: S.colCriterion, width: 96 }, { label: S.colTreatment, width: 66 },
            ]}
            rows={report.registre.map(r => [
              r.ref, r.nom, r.proprietaire ?? S.noOwner, lvl(r.brut), lvl(r.actuel), lvl(r.residuel),
              r.palier.label, r.decision === 'treat' ? S.decisionTreat : S.decisionAccept, criterionText(r, S), S.strategies[r.strategie] ?? r.strategie,
            ])}
          />
        )}
        {Boolean(report.registre.length === 0) && <Text style={s.empty}>{S.none}</Text>}

        {/* Vulnérabilités (ISO 27005) */}
        {Boolean(report.vulnerabilites.length > 0) && (
          <View>
            <Text style={s.h2}>{S.vulnerabilities}</Text>
            <Table
              cols={[{ label: S.colRef, width: 28 }, { label: S.colRisk, width: 250 }, { label: S.colVulnerability, width: 490 }]}
              rows={report.vulnerabilites.map(v => [v.ref, v.risque, v.description])}
            />
          </View>
        )}

        {/* Mesures */}
        <Text style={s.h2}>{S.measures}</Text>
        {Boolean(report.mesures.length > 0) && (
          <Table
            cols={[{ label: S.colRef, width: 28 }, { label: S.measures, width: 330 }, { label: S.colStatus, width: 90 }, { label: S.colEfficacy, width: 70 }, { label: S.colDue, width: 80 }, { label: S.colResponsible, width: 170 }]}
            rows={report.mesures.map(m => [m.ref, m.nom, S.measureStatus[m.statut] ?? m.statut, m.efficacite == null ? '' : `${m.efficacite}/4`, m.echeance ?? '', m.responsable ?? ''])}
          />
        )}
        {Boolean(report.mesures.length === 0) && <Text style={s.empty}>{S.none}</Text>}

        {/* Plans d'action */}
        <Text style={s.h2}>{S.plans}</Text>
        {Boolean(report.plans.length > 0) && (
          <Table
            cols={[{ label: S.colRisks, width: 60 }, { label: S.colAction, width: 330 }, { label: S.colStatus, width: 80 }, { label: S.colPriority, width: 70 }, { label: S.colDue, width: 80 }, { label: S.colResponsible, width: 150 }]}
            rows={report.plans.map(p => [p.refs, p.titre, S.planStatus[p.statut] ?? p.statut, S.priorities[p.priorite] ?? p.priorite, p.echeance ?? '', p.porteur ?? ''])}
          />
        )}
        {Boolean(report.plans.length === 0) && <Text style={s.empty}>{S.none}</Text>}

        <View style={{ marginTop: 18 }} wrap={false}>
          <Text style={s.label}>{S.approval}</Text>
        </View>

        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `ACRA — ${report.standard} — ${S.generatedOn} ${dateStr} — ${pageNumber}/${totalPages}`} />
      </Page>
    </Document>
  )
}

/** Rend le rapport PDF. Appelé au runtime depuis la route d'export. */
export function renderDirectReportPDF(report: DirectReport, locale: string, dateStr: string): Promise<Buffer> {
  return renderToBuffer(<DirectReportPDF report={report} locale={locale} dateStr={dateStr} />)
}
