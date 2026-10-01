/**
 * Rapport de contrôle d'une mission de contrôle permanent (CampagneControle) — module PUR.
 * Contenu : identité de la mission, synthèse, exécutions des contrôles du périmètre dans la fenêtre,
 * questionnaires envoyés (taux de réponse, non-conformités revues et leur rattachement),
 * préconisations avec leur suivi et les plans d'action liés, conclusions à compléter.
 * Produit du Markdown (sous-ensemble de markdown-docx.ts), converti en .docx par la route.
 */

export interface MissionControleRapportData {
  mission: { intitule: string; description: string | null; niveau: string; statut: string; dateDebut: Date | null; dateFin: Date | null }
  controles: { intitule: string; conformes: number; anomalies: number; nonApplicables: number }[]
  questionnaires: { titre: string; total: number; soumises: number; revues: number; nonConformes: { question: string; cible: string | null }[] }[]
  preconisations: { intitule: string; criticite: number | null; responsable: string | null; echeance: Date | null; statut: string; exigence: string | null; plans: string[]; acceptation: string | null }[]
}

/** Libellés résolus (i18n `rapportMissionControle` + statuts), fournis par l'appelant. */
export interface RapportMissionLabels {
  titre: string; genereLe: string; mission: string; niveau: string; statut: string; periode: string; description: string
  synthese: string; kpiControles: string; kpiExecutions: string; kpiAnomalies: string; kpiQuestionnaires: string; kpiTauxReponse: string; kpiNonConformites: string; kpiPreconisations: string; kpiOuvertes: string
  sectionControles: string; colControle: string; colConformes: string; colAnomalies: string; colNa: string
  sectionQuestionnaires: string; colQuestionnaire: string; colReponses: string; colRevues: string; colNonConformes: string
  sectionNonConformites: string; colQuestion: string; colRattachement: string
  sectionPreconisations: string; colPreco: string; colCriticite: string; colResponsable: string; colEcheance: string; colStatut: string; colPlans: string
  acceptation: string; aucun: string; conclusions: string; conclusionsAide: string
  statutsMission: Record<string, string>; statutsPreco: Record<string, string>
}

// Le Markdown des tableaux n'échappe pas « | » ; on neutralise aussi le gras involontaire.
const esc = (s: string | null | undefined) => (s ?? '').replace(/\|/g, '¦').replace(/\*\*/g, '*').replace(/\r?\n/g, ' ').trim()
const jour = (d: Date | null, locale: string) => (d ? d.toLocaleDateString(locale) : '—')
const ligne = (cells: (string | number)[]) => `| ${cells.map(c => esc(String(c))).join(' | ')} |`
const tableau = (entetes: string[], lignes: (string | number)[][]) => [ligne(entetes), `| ${entetes.map(() => '---').join(' | ')} |`, ...lignes.map(ligne)].join('\n')

export function synthetiserMission(d: MissionControleRapportData) {
  const executions = d.controles.reduce((n, c) => n + c.conformes + c.anomalies + c.nonApplicables, 0)
  const anomalies = d.controles.reduce((n, c) => n + c.anomalies, 0)
  const total = d.questionnaires.reduce((n, q) => n + q.total, 0)
  const soumises = d.questionnaires.reduce((n, q) => n + q.soumises, 0)
  const nonConformites = d.questionnaires.reduce((n, q) => n + q.nonConformes.length, 0)
  const ouvertes = d.preconisations.filter(p => p.statut === 'OUVERT' || p.statut === 'EN_COURS').length
  return { controles: d.controles.length, executions, anomalies, questionnaires: d.questionnaires.length, tauxReponse: total ? Math.round((soumises / total) * 100) : null, nonConformites, preconisations: d.preconisations.length, ouvertes }
}

export function rapportMissionControleMarkdown(d: MissionControleRapportData, L: RapportMissionLabels, locale: string, now: Date): string {
  const s = synthetiserMission(d)
  const m = d.mission
  const out: string[] = [
    `# ${esc(L.titre)} — ${esc(m.intitule)}`,
    `${esc(L.genereLe)} ${now.toLocaleDateString(locale)}`,
    `**${esc(L.mission)}** : ${esc(m.intitule)} · **${esc(L.niveau)}** : ${esc(m.niveau)} · **${esc(L.statut)}** : ${esc(L.statutsMission[m.statut] ?? m.statut)} · **${esc(L.periode)}** : ${jour(m.dateDebut, locale)} → ${jour(m.dateFin, locale)}`,
  ]
  if (m.description) out.push(`**${esc(L.description)}** : ${esc(m.description)}`)
  out.push(`## ${esc(L.synthese)}`, tableau([L.synthese, ''], [
    [L.kpiControles, s.controles], [L.kpiExecutions, s.executions], [L.kpiAnomalies, s.anomalies],
    [L.kpiQuestionnaires, s.questionnaires], [L.kpiTauxReponse, s.tauxReponse === null ? '—' : `${s.tauxReponse} %`],
    [L.kpiNonConformites, s.nonConformites], [L.kpiPreconisations, s.preconisations], [L.kpiOuvertes, s.ouvertes],
  ]))
  out.push(`## ${esc(L.sectionControles)}`, d.controles.length
    ? tableau([L.colControle, L.colConformes, L.colAnomalies, L.colNa], d.controles.map(c => [c.intitule, c.conformes, c.anomalies, c.nonApplicables]))
    : esc(L.aucun))
  out.push(`## ${esc(L.sectionQuestionnaires)}`, d.questionnaires.length
    ? tableau([L.colQuestionnaire, L.colReponses, L.colRevues, L.colNonConformes], d.questionnaires.map(q => [q.titre, `${q.soumises} / ${q.total}`, q.revues, q.nonConformes.length]))
    : esc(L.aucun))
  const nc = d.questionnaires.flatMap(q => q.nonConformes.map(n => [q.titre, n.question, n.cible ?? '—']))
  if (nc.length) out.push(`## ${esc(L.sectionNonConformites)}`, tableau([L.colQuestionnaire, L.colQuestion, L.colRattachement], nc))
  out.push(`## ${esc(L.sectionPreconisations)}`, d.preconisations.length
    ? tableau([L.colPreco, L.colCriticite, L.colResponsable, L.colEcheance, L.colStatut, L.colPlans], d.preconisations.map(p => [
      p.exigence ? `${p.intitule} (${p.exigence})` : p.intitule, p.criticite ?? '—', p.responsable ?? '—', jour(p.echeance, locale),
      p.acceptation ? `${L.statutsPreco[p.statut] ?? p.statut} — ${L.acceptation} : ${p.acceptation}` : (L.statutsPreco[p.statut] ?? p.statut),
      p.plans.length ? p.plans.join(', ') : '—',
    ]))
    : esc(L.aucun))
  out.push(`## ${esc(L.conclusions)}`, `> ${esc(L.conclusionsAide)}`)
  return out.join('\n\n')
}
