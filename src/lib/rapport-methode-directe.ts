// ─── Rapport d'appréciation des risques par méthode (saisie directe) — PUR ───
// P4 de l'audit des méthodes : information documentée / compte rendu
// (ISO/IEC 27005:2022 clause 10, ISO 31000:2018 §6.7, NIST SP 800-30 Rev. 1
// étape 3 « Communicate Results »). Construit un modèle unique, rendu ensuite en
// PDF (`rapport-methode-directe-pdf-template.tsx`, compilé par esbuild) et en Excel
// (route d'export). Aucune dépendance serveur : importable par le gabarit PDF.
// Les décisions reprennent EXACTEMENT l'évaluation de l'écran (P1/P2).

import { METHOD_META, isRiskMethod } from '@/lib/methodes'
import { evaluateRisk, evaluatedLevel, type EvaluableRisk, type EvaluationContext, type Decision, type DecisionBasis } from '@/lib/risque-priorisation'

export interface DirectReportInput {
  analyse: { nom: string; methode: string; cadrage?: { perimetre?: string | null; objectifsEtude?: string | null } | null }
  risques: (EvaluableRisk & {
    id: string; nom: string; strategie: string; proprietaire?: string | null
    graviteResiduelle?: number | null; vraisemblanceResiduelle?: number | null; niveauResiduel?: number | null
    vulnerabilites?: unknown
  })[]
  mesures: { nom: string; statut: string; efficacite: number | null; echeance: Date | null; responsable: string | null; risqueId: string | null }[]
  /** Plans d'action (PlanAction) avec les risques d'analyse liés (liens RISQUE_ANALYSE). */
  plans: { titre: string; statut: string; priorite: string; echeance: Date | null; porteur: string | null; risqueIds: string[] }[]
}

type Level = { gravite: number; vraisemblance: number; niveau: number }
export interface DirectReportRow {
  ref: string; nom: string; proprietaire: string | null; strategie: string
  brut: Level; actuel: Level; residuel: Level
  palier: { label: string; couleur: string }
  decision: Decision; basis: DecisionBasis; seuilAppetit?: number
  nbMesures: number; nbPlans: number
}
export interface DirectReport {
  titre: string; methode: string; standard: string
  contexte: { perimetre: string | null; objectifs: string | null }
  synthese: {
    total: number; aTraiter: number; acceptables: number; sansProprietaire: number; mesures: number; plans: number
    parPalier: { label: string; couleur: string; count: number }[]
  }
  registre: DirectReportRow[]
  vulnerabilites: { ref: string; risque: string; description: string }[]
  mesures: { ref: string; nom: string; statut: string; efficacite: number | null; echeance: string | null; responsable: string | null }[]
  plans: { refs: string; titre: string; statut: string; priorite: string; echeance: string | null; porteur: string | null }[]
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Construit le rapport : registre évalué (trié par niveau évalué), annexes rattachées par référence. */
export function buildDirectReport(input: DirectReportInput, ctx: EvaluationContext): DirectReport {
  const evaluated = input.risques
    .map(r => ({ r, e: evaluateRisk(r, ctx), actuel: evaluatedLevel(r) }))
    .sort((a, b) => b.e.niveau - a.e.niveau)
  const refOf = new Map(evaluated.map((x, i) => [x.r.id, `R${i + 1}`]))
  const countBy = (ids: (string | null)[]) => ids.reduce((m, id) => (id ? m.set(id, (m.get(id) ?? 0) + 1) : m), new Map<string, number>())
  const mesuresPar = countBy(input.mesures.map(m => m.risqueId))
  const plansPar = countBy(input.plans.flatMap(p => p.risqueIds))

  const registre: DirectReportRow[] = evaluated.map(({ r, e, actuel }) => {
    const gR = r.graviteResiduelle ?? actuel.gravite, vR = r.vraisemblanceResiduelle ?? actuel.vraisemblance
    return {
      ref: refOf.get(r.id)!, nom: r.nom, proprietaire: text(r.proprietaire), strategie: r.strategie,
      brut: { gravite: r.gravite, vraisemblance: r.vraisemblance, niveau: r.niveauRisque },
      actuel, residuel: { gravite: gR, vraisemblance: vR, niveau: r.niveauResiduel ?? gR * vR },
      palier: { label: e.seuil.label, couleur: e.seuil.couleur },
      decision: e.decision, basis: e.basis, ...(e.seuilAppetit != null ? { seuilAppetit: e.seuilAppetit } : {}),
      nbMesures: mesuresPar.get(r.id) ?? 0, nbPlans: plansPar.get(r.id) ?? 0,
    }
  })

  const paliers = [...ctx.scale.seuilsMatrice].sort((a, b) => a.scoreMin - b.scoreMin)
  return {
    titre: input.analyse.nom,
    methode: input.analyse.methode,
    standard: isRiskMethod(input.analyse.methode) ? METHOD_META[input.analyse.methode].standard : input.analyse.methode,
    contexte: { perimetre: text(input.analyse.cadrage?.perimetre), objectifs: text(input.analyse.cadrage?.objectifsEtude) },
    synthese: {
      total: registre.length,
      aTraiter: registre.filter(x => x.decision === 'treat').length,
      acceptables: registre.filter(x => x.decision === 'accept').length,
      sansProprietaire: registre.filter(x => !x.proprietaire).length,
      mesures: input.mesures.length, plans: input.plans.length,
      parPalier: paliers.map(p => ({ label: p.label, couleur: p.couleur, count: registre.filter(x => x.palier.label === p.label).length })),
    },
    registre,
    vulnerabilites: evaluated.flatMap(({ r }) => (Array.isArray(r.vulnerabilites) ? r.vulnerabilites : [])
      .map(v => text((v as { description?: unknown })?.description))
      .filter((d): d is string => !!d)
      .map(description => ({ ref: refOf.get(r.id)!, risque: r.nom, description }))),
    mesures: input.mesures.map(m => ({
      ref: (m.risqueId && refOf.get(m.risqueId)) || '—', nom: m.nom, statut: m.statut,
      efficacite: m.efficacite, echeance: iso(m.echeance), responsable: text(m.responsable),
    })),
    plans: input.plans.map(p => ({
      refs: p.risqueIds.map(id => refOf.get(id)).filter(Boolean).join(', ') || '—',
      titre: p.titre, statut: p.statut, priorite: p.priorite, echeance: iso(p.echeance), porteur: text(p.porteur),
    })),
  }
}

// ─── Libellés du rapport (PDF + Excel), 5 langues ────────────────────────────

export type ReportStrings = {
  reportTitle: string; method: string; generatedOn: string; evalNote: string
  context: string; scope: string; objectives: string; notProvided: string
  summary: string; total: string; toTreat: string; acceptable: string; noOwner: string; measures: string; plans: string; byBand: string
  register: string; colRef: string; colRisk: string; colOwner: string; colInherent: string; colCurrent: string; colResidual: string
  colBand: string; colDecision: string; colCriterion: string; colTreatment: string
  decisionTreat: string; decisionAccept: string; criterionAppetite: string; criterionScale: string
  vulnerabilities: string; colVulnerability: string; colStatus: string; colEfficacy: string; colDue: string; colResponsible: string
  colAction: string; colPriority: string; colRisks: string; none: string; approval: string
  strategies: Record<string, string>; measureStatus: Record<string, string>; planStatus: Record<string, string>; priorities: Record<string, string>
}

export const REPORT_STRINGS: Record<string, ReportStrings> = {
  fr: {
    reportTitle: 'Rapport d’appréciation des risques', method: 'Méthode', generatedOn: 'Généré le',
    evalNote: 'Chaque risque est évalué à son niveau actuel (avec les mesures existantes) et comparé à l’appétit au risque de l’organisation ; à défaut, aux paliers de son échelle.',
    context: 'Contexte', scope: 'Périmètre', objectives: 'Objectifs / critères', notProvided: 'Non renseigné',
    summary: 'Synthèse', total: 'Risques', toTreat: 'À traiter', acceptable: 'Acceptables', noOwner: 'Sans propriétaire', measures: 'Mesures', plans: 'Plans d’action', byBand: 'Répartition par palier (niveau actuel)',
    register: 'Registre des risques', colRef: 'Réf.', colRisk: 'Risque', colOwner: 'Propriétaire', colInherent: 'Brut', colCurrent: 'Actuel', colResidual: 'Résiduel',
    colBand: 'Palier', colDecision: 'Décision', colCriterion: 'Critère', colTreatment: 'Traitement',
    decisionTreat: 'À traiter', decisionAccept: 'Acceptable', criterionAppetite: 'Appétit ≤ {seuil}', criterionScale: 'Échelle',
    vulnerabilities: 'Vulnérabilités', colVulnerability: 'Vulnérabilité', colStatus: 'Statut', colEfficacy: 'Efficacité', colDue: 'Échéance', colResponsible: 'Responsable',
    colAction: 'Action', colPriority: 'Priorité', colRisks: 'Risques', none: 'Aucun élément.', approval: 'Approuvé par : ____________________   Date : __________',
    strategies: { REDUIRE: 'Réduire', ACCEPTER: 'Accepter', TRANSFERER: 'Transférer', REFUSER: 'Refuser', SURVEILLER: 'Surveiller' },
    measureStatus: { A_FAIRE: 'À faire', EN_COURS: 'En cours', REALISE: 'Réalisé', REPORTE: 'Reporté' },
    planStatus: { A_FAIRE: 'À faire', EN_COURS: 'En cours', FAIT: 'Fait' },
    priorities: { CRITIQUE: 'Critique', MAJEUR: 'Majeur', MODERE: 'Modéré' },
  },
  en: {
    reportTitle: 'Risk assessment report', method: 'Method', generatedOn: 'Generated on',
    evalNote: 'Each risk is assessed at its current level (with existing controls) and compared with the organisation’s risk appetite or, failing that, with the bands of its scale.',
    context: 'Context', scope: 'Scope', objectives: 'Objectives / criteria', notProvided: 'Not provided',
    summary: 'Summary', total: 'Risks', toTreat: 'To treat', acceptable: 'Acceptable', noOwner: 'No owner', measures: 'Controls', plans: 'Action plans', byBand: 'Distribution by band (current level)',
    register: 'Risk register', colRef: 'Ref.', colRisk: 'Risk', colOwner: 'Owner', colInherent: 'Inherent', colCurrent: 'Current', colResidual: 'Residual',
    colBand: 'Band', colDecision: 'Decision', colCriterion: 'Criterion', colTreatment: 'Treatment',
    decisionTreat: 'To treat', decisionAccept: 'Acceptable', criterionAppetite: 'Appetite ≤ {seuil}', criterionScale: 'Scale',
    vulnerabilities: 'Vulnerabilities', colVulnerability: 'Vulnerability', colStatus: 'Status', colEfficacy: 'Effectiveness', colDue: 'Due date', colResponsible: 'Responsible',
    colAction: 'Action', colPriority: 'Priority', colRisks: 'Risks', none: 'No items.', approval: 'Approved by: ____________________   Date: __________',
    strategies: { REDUIRE: 'Reduce', ACCEPTER: 'Accept', TRANSFERER: 'Transfer', REFUSER: 'Avoid', SURVEILLER: 'Monitor' },
    measureStatus: { A_FAIRE: 'To do', EN_COURS: 'In progress', REALISE: 'Implemented', REPORTE: 'Postponed' },
    planStatus: { A_FAIRE: 'To do', EN_COURS: 'In progress', FAIT: 'Done' },
    priorities: { CRITIQUE: 'Critical', MAJEUR: 'Major', MODERE: 'Moderate' },
  },
  de: {
    reportTitle: 'Bericht zur Risikobeurteilung', method: 'Methode', generatedOn: 'Erstellt am',
    evalNote: 'Jedes Risiko wird auf seinem aktuellen Niveau (mit bestehenden Maßnahmen) bewertet und mit dem Risikoappetit der Organisation verglichen, andernfalls mit den Stufen ihrer Skala.',
    context: 'Kontext', scope: 'Geltungsbereich', objectives: 'Ziele / Kriterien', notProvided: 'Nicht angegeben',
    summary: 'Zusammenfassung', total: 'Risiken', toTreat: 'Zu behandeln', acceptable: 'Akzeptabel', noOwner: 'Ohne Risikoeigentümer', measures: 'Maßnahmen', plans: 'Aktionspläne', byBand: 'Verteilung nach Stufe (aktuelles Niveau)',
    register: 'Risikoregister', colRef: 'Ref.', colRisk: 'Risiko', colOwner: 'Risikoeigentümer', colInherent: 'Brutto', colCurrent: 'Aktuell', colResidual: 'Restrisiko',
    colBand: 'Stufe', colDecision: 'Entscheidung', colCriterion: 'Kriterium', colTreatment: 'Behandlung',
    decisionTreat: 'Zu behandeln', decisionAccept: 'Akzeptabel', criterionAppetite: 'Risikoappetit ≤ {seuil}', criterionScale: 'Skala',
    vulnerabilities: 'Schwachstellen', colVulnerability: 'Schwachstelle', colStatus: 'Status', colEfficacy: 'Wirksamkeit', colDue: 'Fälligkeit', colResponsible: 'Verantwortlich',
    colAction: 'Maßnahme', colPriority: 'Priorität', colRisks: 'Risiken', none: 'Keine Einträge.', approval: 'Genehmigt von: ____________________   Datum: __________',
    strategies: { REDUIRE: 'Reduzieren', ACCEPTER: 'Akzeptieren', TRANSFERER: 'Übertragen', REFUSER: 'Vermeiden', SURVEILLER: 'Überwachen' },
    measureStatus: { A_FAIRE: 'Zu erledigen', EN_COURS: 'In Bearbeitung', REALISE: 'Umgesetzt', REPORTE: 'Verschoben' },
    planStatus: { A_FAIRE: 'Zu erledigen', EN_COURS: 'In Bearbeitung', FAIT: 'Erledigt' },
    priorities: { CRITIQUE: 'Kritisch', MAJEUR: 'Hoch', MODERE: 'Mittel' },
  },
  es: {
    reportTitle: 'Informe de apreciación de riesgos', method: 'Método', generatedOn: 'Generado el',
    evalNote: 'Cada riesgo se evalúa en su nivel actual (con las medidas existentes) y se compara con el apetito de riesgo de la organización o, en su defecto, con las franjas de su escala.',
    context: 'Contexto', scope: 'Alcance', objectives: 'Objetivos / criterios', notProvided: 'No indicado',
    summary: 'Síntesis', total: 'Riesgos', toTreat: 'Por tratar', acceptable: 'Aceptables', noOwner: 'Sin propietario', measures: 'Medidas', plans: 'Planes de acción', byBand: 'Distribución por franja (nivel actual)',
    register: 'Registro de riesgos', colRef: 'Ref.', colRisk: 'Riesgo', colOwner: 'Propietario', colInherent: 'Bruto', colCurrent: 'Actual', colResidual: 'Residual',
    colBand: 'Franja', colDecision: 'Decisión', colCriterion: 'Criterio', colTreatment: 'Tratamiento',
    decisionTreat: 'Por tratar', decisionAccept: 'Aceptable', criterionAppetite: 'Apetito ≤ {seuil}', criterionScale: 'Escala',
    vulnerabilities: 'Vulnerabilidades', colVulnerability: 'Vulnerabilidad', colStatus: 'Estado', colEfficacy: 'Eficacia', colDue: 'Vencimiento', colResponsible: 'Responsable',
    colAction: 'Acción', colPriority: 'Prioridad', colRisks: 'Riesgos', none: 'Ningún elemento.', approval: 'Aprobado por: ____________________   Fecha: __________',
    strategies: { REDUIRE: 'Reducir', ACCEPTER: 'Aceptar', TRANSFERER: 'Transferir', REFUSER: 'Evitar', SURVEILLER: 'Vigilar' },
    measureStatus: { A_FAIRE: 'Por hacer', EN_COURS: 'En curso', REALISE: 'Implantada', REPORTE: 'Aplazada' },
    planStatus: { A_FAIRE: 'Por hacer', EN_COURS: 'En curso', FAIT: 'Hecho' },
    priorities: { CRITIQUE: 'Crítica', MAJEUR: 'Mayor', MODERE: 'Moderada' },
  },
  it: {
    reportTitle: 'Rapporto di valutazione dei rischi', method: 'Metodo', generatedOn: 'Generato il',
    evalNote: 'Ogni rischio è valutato al suo livello attuale (con le misure esistenti) e confrontato con la propensione al rischio dell’organizzazione o, in mancanza, con le fasce della sua scala.',
    context: 'Contesto', scope: 'Perimetro', objectives: 'Obiettivi / criteri', notProvided: 'Non indicato',
    summary: 'Sintesi', total: 'Rischi', toTreat: 'Da trattare', acceptable: 'Accettabili', noOwner: 'Senza titolare', measures: 'Misure', plans: 'Piani d’azione', byBand: 'Ripartizione per fascia (livello attuale)',
    register: 'Registro dei rischi', colRef: 'Rif.', colRisk: 'Rischio', colOwner: 'Titolare', colInherent: 'Lordo', colCurrent: 'Attuale', colResidual: 'Residuo',
    colBand: 'Fascia', colDecision: 'Decisione', colCriterion: 'Criterio', colTreatment: 'Trattamento',
    decisionTreat: 'Da trattare', decisionAccept: 'Accettabile', criterionAppetite: 'Propensione ≤ {seuil}', criterionScale: 'Scala',
    vulnerabilities: 'Vulnerabilità', colVulnerability: 'Vulnerabilità', colStatus: 'Stato', colEfficacy: 'Efficacia', colDue: 'Scadenza', colResponsible: 'Responsabile',
    colAction: 'Azione', colPriority: 'Priorità', colRisks: 'Rischi', none: 'Nessun elemento.', approval: 'Approvato da: ____________________   Data: __________',
    strategies: { REDUIRE: 'Ridurre', ACCEPTER: 'Accettare', TRANSFERER: 'Trasferire', REFUSER: 'Evitare', SURVEILLER: 'Monitorare' },
    measureStatus: { A_FAIRE: 'Da fare', EN_COURS: 'In corso', REALISE: 'Attuata', REPORTE: 'Rinviata' },
    planStatus: { A_FAIRE: 'Da fare', EN_COURS: 'In corso', FAIT: 'Fatto' },
    priorities: { CRITIQUE: 'Critica', MAJEUR: 'Maggiore', MODERE: 'Moderata' },
  },
}

/** Libellés du rapport dans la langue demandée (repli français). */
export function reportStrings(locale: string): ReportStrings {
  return REPORT_STRINGS[locale] ?? REPORT_STRINGS.fr
}

/** Texte du critère de décision d'une ligne (appétit cité, sinon palier de l'échelle). */
export function criterionText(row: DirectReportRow, S: ReportStrings): string {
  return row.basis === 'APPETIT' && row.seuilAppetit != null
    ? S.criterionAppetite.replace('{seuil}', String(row.seuilAppetit))
    : `${S.criterionScale} : ${row.palier.label}`
}
