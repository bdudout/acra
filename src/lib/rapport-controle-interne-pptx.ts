// ─── Rapport annuel de contrôle interne — format PRÉSENTATION (PPTX) ─────────
// Même donnée que l'export PDF (buildRapportControleInterne) : un renderer de
// substitution vers un jeu de diapositives destiné aux comités (organe de
// surveillance, comité des risques). pptxgenjs est du JS pur (pas de compilation
// autonome nécessaire, contrairement aux gabarits react-pdf).

import PptxGenJS from 'pptxgenjs'
import type { RapportControleInterne, LigneDefense } from './rapport-controle-interne'

const COLORS = {
  primary: '4338CA', ink: '111827', muted: '6B7280', danger: 'DC2626', ok: '16A34A', warn: 'D97706',
  band: 'EEF2FF', white: 'FFFFFF', line: 'E5E7EB',
}

type Dict = Record<string, string>
type Strings = {
  title: string; subtitle: string; ligne: Record<LigneDefense, string>
  appreciationLabel: string; appreciation: Dict; section: Dict; metric: Dict; highlight: Dict
  highlightsTitle: string; noAlert: string; year: string; approval: string; generatedOn: string
}

const SECTION_FR = { risques: 'Cartographie des risques', appetit: 'Appétit au risque', incidents: 'Incidents & pertes', controles: 'Contrôle permanent', audit: 'Audit interne', regulateur: 'Suivi régulateur', kri: 'Indicateurs clés (KRI)', dora: 'Résilience opérationnelle TIC (DORA)' }
const METRIC_FR = { total: 'Total', eleve: 'Élevés', moyen: 'Moyens', faible: 'Faibles', nonCote: 'Non cotés', actionsTotal: 'Actions', avancement: 'Avancement', actionsEnRetard: 'Actions en retard', horsAppetit: 'Hors appétit', dansAppetit: 'Dans l\'appétit', evalues: 'Évalués', ouverts: 'Ouverts', perteNette: 'Perte nette (€)', tauxConformite: 'Conformité', anomalies: 'Anomalies', tauxConformiteN1: 'Conformité N1', anomaliesN1: 'Anomalies N1', tauxConformiteN2: 'Conformité N2', anomaliesN2: 'Anomalies N2', critiques: 'Constats critiques', recosEnRetard: 'Recos en retard', echues: 'Échéances dépassées', sous30j: 'Sous 30 j', enAlerte: 'En alerte', critique: 'Critiques', majeurs: 'Incidents majeurs' }
const HL_FR = { horsAppetit: 'risque(s) hors appétit', actionsEnRetard: 'action(s) de traitement en retard', conformiteFaible: '% de conformité du contrôle permanent (sous le seuil)', constatsCritiques: 'constat(s) d\'audit critiques ouverts', regulateurEchu: 'recommandation(s) régulateur échue(s)', kriCritique: 'KRI en zone critique', doraMajeurs: 'incident(s) TIC majeur(s) (DORA)', incidentsOuverts: 'incident(s) opérationnel(s) ouvert(s)' }

const SECTION_EN = { risques: 'Risk map', appetit: 'Risk appetite', incidents: 'Incidents & losses', controles: 'Permanent control', audit: 'Internal audit', regulateur: 'Regulator tracking', kri: 'Key risk indicators (KRI)', dora: 'ICT operational resilience (DORA)' }
const METRIC_EN = { total: 'Total', eleve: 'High', moyen: 'Medium', faible: 'Low', nonCote: 'Unrated', actionsTotal: 'Actions', avancement: 'Progress', actionsEnRetard: 'Overdue actions', horsAppetit: 'Outside appetite', dansAppetit: 'Within appetite', evalues: 'Evaluated', ouverts: 'Open', perteNette: 'Net loss (€)', tauxConformite: 'Compliance', anomalies: 'Anomalies', tauxConformiteN1: 'N1 compliance', anomaliesN1: 'N1 anomalies', tauxConformiteN2: 'N2 compliance', anomaliesN2: 'N2 anomalies', critiques: 'Critical findings', recosEnRetard: 'Overdue recs', echues: 'Overdue', sous30j: 'Within 30d', enAlerte: 'In alert', critique: 'Critical', majeurs: 'Major incidents' }
const HL_EN = { horsAppetit: 'risk(s) outside appetite', actionsEnRetard: 'overdue treatment action(s)', conformiteFaible: '% permanent-control compliance (below threshold)', constatsCritiques: 'open critical audit finding(s)', regulateurEchu: 'overdue regulator recommendation(s)', kriCritique: 'KRI in critical zone', doraMajeurs: 'major ICT incident(s) (DORA)', incidentsOuverts: 'open operational incident(s)' }

const STRINGS: Record<string, Strings> = {
  fr: { title: 'Rapport annuel de contrôle interne', subtitle: 'Dispositif de maîtrise des risques', ligne: { '1': '1ʳᵉ ligne de défense — Contrôle permanent', '2': '2ᵉ ligne de défense — Risques & conformité', '3': '3ᵉ ligne de défense — Audit interne', TIC: 'Résilience opérationnelle numérique (DORA)' }, appreciationLabel: 'Appréciation globale du dispositif', appreciation: { SATISFAISANT: 'Satisfaisant', A_RENFORCER: 'À renforcer', INSUFFISANT: 'Insuffisant' }, section: SECTION_FR, metric: METRIC_FR, highlight: HL_FR, highlightsTitle: 'Points d\'attention', noAlert: 'Aucun point d\'alerte : indicateurs dans les seuils.', year: 'Exercice', approval: 'Approuvé par l\'organe de surveillance : ____________________   Date : __________', generatedOn: 'Généré le' },
  en: { title: 'Annual internal control report', subtitle: 'Risk management framework', ligne: { '1': '1st line of defence — Permanent control', '2': '2nd line of defence — Risk & compliance', '3': '3rd line of defence — Internal audit', TIC: 'Digital operational resilience (DORA)' }, appreciationLabel: 'Overall assessment of the framework', appreciation: { SATISFAISANT: 'Satisfactory', A_RENFORCER: 'To be strengthened', INSUFFISANT: 'Insufficient' }, section: SECTION_EN, metric: METRIC_EN, highlight: HL_EN, highlightsTitle: 'Points of attention', noAlert: 'No alert: indicators within thresholds.', year: 'Financial year', approval: 'Approved by the supervisory body: ____________________   Date: __________', generatedOn: 'Generated on' },
  de: { title: 'Jährlicher Bericht über die interne Kontrolle', subtitle: 'Risikomanagement-Rahmenwerk', ligne: { '1': '1. Verteidigungslinie — Permanente Kontrolle', '2': '2. Verteidigungslinie — Risiken & Compliance', '3': '3. Verteidigungslinie — Interne Revision', TIC: 'Digitale operationelle Resilienz (DORA)' }, appreciationLabel: 'Gesamtbeurteilung des Systems', appreciation: { SATISFAISANT: 'Zufriedenstellend', A_RENFORCER: 'Zu stärken', INSUFFISANT: 'Unzureichend' }, section: SECTION_EN, metric: METRIC_EN, highlight: HL_EN, highlightsTitle: 'Aufmerksamkeitspunkte', noAlert: 'Kein Alarm: Indikatoren innerhalb der Schwellen.', year: 'Geschäftsjahr', approval: 'Vom Aufsichtsorgan genehmigt: ____________________   Datum: __________', generatedOn: 'Erstellt am' },
  es: { title: 'Informe anual de control interno', subtitle: 'Marco de gestión de riesgos', ligne: { '1': '1ª línea de defensa — Control permanente', '2': '2ª línea de defensa — Riesgos y cumplimiento', '3': '3ª línea de defensa — Auditoría interna', TIC: 'Resiliencia operativa digital (DORA)' }, appreciationLabel: 'Valoración global del dispositivo', appreciation: { SATISFAISANT: 'Satisfactorio', A_RENFORCER: 'A reforzar', INSUFFISANT: 'Insuficiente' }, section: SECTION_EN, metric: METRIC_EN, highlight: HL_EN, highlightsTitle: 'Puntos de atención', noAlert: 'Sin alertas: indicadores dentro de los umbrales.', year: 'Ejercicio', approval: 'Aprobado por el órgano de supervisión: ____________________   Fecha: __________', generatedOn: 'Generado el' },
  it: { title: 'Relazione annuale sul controllo interno', subtitle: 'Sistema di gestione dei rischi', ligne: { '1': '1ª linea di difesa — Controllo permanente', '2': '2ª linea di difesa — Rischi e conformità', '3': '3ª linea di difesa — Audit interno', TIC: 'Resilienza operativa digitale (DORA)' }, appreciationLabel: 'Valutazione complessiva del dispositivo', appreciation: { SATISFAISANT: 'Soddisfacente', A_RENFORCER: 'Da rafforzare', INSUFFISANT: 'Insufficiente' }, section: SECTION_EN, metric: METRIC_EN, highlight: HL_EN, highlightsTitle: 'Punti di attenzione', noAlert: 'Nessuna allerta: indicatori entro le soglie.', year: 'Esercizio', approval: 'Approvato dall\'organo di vigilanza: ____________________   Data: __________', generatedOn: 'Generato il' },
}

function appHex(a: string): string {
  if (a === 'SATISFAISANT') return COLORS.ok
  if (a === 'A_RENFORCER') return COLORS.warn
  return COLORS.danger
}

/** Rend le rapport annuel de contrôle interne au format PPTX (Buffer). */
export async function renderRapportControleInternePptx(
  rapport: RapportControleInterne, locale: string, orgNom: string, annee: string, dateStr: string,
): Promise<Buffer> {
  const S = STRINGS[locale] ?? STRINGS.fr
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 in
  pptx.defineSlideMaster({
    title: 'ACRA', background: { color: COLORS.white },
    objects: [{ line: { x: 0.5, y: 7.0, w: 12.33, h: 0, line: { color: COLORS.line, width: 0.5 } } }],
    slideNumber: { x: 12.4, y: 7.05, color: COLORS.muted, fontSize: 8 },
  })

  // ── Diapo de titre ─────────────────────────────────────────────────────────
  const t = pptx.addSlide({ masterName: 'ACRA' })
  t.addShape('rect', { x: 0, y: 0, w: 13.33, h: 2.4, fill: { color: COLORS.band } })
  t.addText(S.title, { x: 0.6, y: 0.7, w: 12, h: 0.9, fontSize: 30, bold: true, color: COLORS.primary })
  const soustitre = `${orgNom ? orgNom + ' — ' : ''}${S.subtitle}${annee ? ` · ${S.year} ${annee}` : ''}`
  t.addText(soustitre, { x: 0.6, y: 1.6, w: 12, h: 0.5, fontSize: 15, color: COLORS.muted })
  t.addText(S.appreciationLabel, { x: 0.6, y: 3.2, w: 12, h: 0.4, fontSize: 13, color: COLORS.muted })
  t.addText(S.appreciation[rapport.appreciation] ?? rapport.appreciation, { x: 0.6, y: 3.6, w: 12, h: 0.9, fontSize: 40, bold: true, color: appHex(rapport.appreciation) })
  t.addText(`${S.generatedOn} ${dateStr}`, { x: 0.6, y: 6.4, w: 12, h: 0.3, fontSize: 10, color: COLORS.muted })

  // ── Diapo points d'attention ────────────────────────────────────────────────
  const h = pptx.addSlide({ masterName: 'ACRA' })
  h.addText(S.highlightsTitle, { x: 0.5, y: 0.4, w: 12.3, h: 0.6, fontSize: 22, bold: true, color: COLORS.ink })
  if (rapport.highlights.length > 0) {
    h.addText(
      rapport.highlights.map(hl => ({
        text: `${hl.value} ${S.highlight[hl.key] ?? hl.key}`,
        options: { bullet: { code: '2022' }, color: hl.niveau === 'alerte' ? COLORS.danger : COLORS.ink, fontSize: 16, paraSpaceAfter: 8 },
      })),
      { x: 0.7, y: 1.3, w: 11.9, h: 5.2, valign: 'top' },
    )
  } else {
    h.addText(S.noAlert, { x: 0.7, y: 1.4, w: 11.9, h: 0.6, fontSize: 16, color: COLORS.ok, italic: true })
  }

  // ── Une diapo par ligne de défense ──────────────────────────────────────────
  for (const g of rapport.groupes) {
    const sl = pptx.addSlide({ masterName: 'ACRA' })
    sl.addText(S.ligne[g.ligne] ?? g.ligne, { x: 0.5, y: 0.4, w: 12.3, h: 0.6, fontSize: 20, bold: true, color: COLORS.primary })
    const rows: PptxGenJS.TableRow[] = []
    for (const sec of g.sections) {
      const runs = sec.metrics.flatMap((m, i) => {
        const label = S.metric[m.key] ?? m.key
        const chunk = [{ text: `${label} : `, options: { fontSize: 11, color: COLORS.muted } },
          { text: String(m.value), options: { fontSize: 11, bold: true, color: m.alerte ? COLORS.danger : COLORS.ink } }]
        if (i < sec.metrics.length - 1) chunk.push({ text: '    ', options: { fontSize: 11, color: COLORS.muted } })
        return chunk
      })
      rows.push([
        { text: S.section[sec.id] ?? sec.id, options: { fontSize: 12, bold: true, color: COLORS.ink, valign: 'middle' } },
        { text: runs, options: { valign: 'middle' } },
      ])
    }
    sl.addTable(rows, { x: 0.5, y: 1.2, w: 12.3, colW: [3.2, 9.1], border: { type: 'solid', color: COLORS.line, pt: 0.5 }, autoPage: true, rowH: 0.4 })
  }

  // ── Diapo d'approbation ──────────────────────────────────────────────────────
  const a = pptx.addSlide({ masterName: 'ACRA' })
  a.addText(S.appreciationLabel, { x: 0.5, y: 2.6, w: 12.3, h: 0.5, fontSize: 14, color: COLORS.muted, align: 'center' })
  a.addText(S.appreciation[rapport.appreciation] ?? rapport.appreciation, { x: 0.5, y: 3.1, w: 12.3, h: 0.9, fontSize: 34, bold: true, color: appHex(rapport.appreciation), align: 'center' })
  a.addText(S.approval, { x: 0.5, y: 5.4, w: 12.3, h: 0.5, fontSize: 12, color: COLORS.muted, align: 'center' })

  const out = await pptx.write({ outputType: 'nodebuffer' })
  return out as Buffer
}
