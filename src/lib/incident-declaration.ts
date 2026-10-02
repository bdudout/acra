// ─── Déclaration d'un incident à une autorité : champs, compléments et fichiers JSON (PUR) ────────────────────────────────
// DORA : les champs reprennent la numérotation et les intitulés (en anglais, langue de référence des modèles) de l'annexe I du
// règlement d'exécution (UE) 2025/302 (formulaires et modèles de notification des incidents majeurs liés aux TIC). ACRA PRÉREMPLIT
// ce qu'il sait (incident, critères de classification, chronologie, pertes) et laisse l'entité compléter le reste ; une valeur saisie
// l'emporte toujours sur la déduction. Le canal, le format de dépôt et la langue sont fixés par l'autorité compétente nationale :
// le fichier JSON est une AIDE À LA DÉCLARATION (pivot structuré), il ne vaut pas dépôt. Rien n'est transmis par ACRA.
// Les listes de choix de l'ITS ne sont pas reproduites : les champs à choix restent en texte libre (à reprendre de l'ITS).

import { criteresDeclenches, type DoraCritere, type DoraCriteres } from './dora'

export const DORA_STAGES = ['INITIAL', 'INTERMEDIATE', 'FINAL'] as const
export type DoraStage = (typeof DORA_STAGES)[number]
type FieldStage = 'GENERAL' | DoraStage
export type FieldKind = 'text' | 'number' | 'datetime' | 'bool' | 'list' | 'duration' | 'amount'
export interface DoraItsField { id: string; stage: FieldStage; name: string; kind: FieldKind; editable: boolean }

const f = (id: string, stage: FieldStage, name: string, kind: FieldKind = 'text', editable = true): DoraItsField => ({ id, stage, name, kind, editable })

/** Annexe I du règlement d'exécution (UE) 2025/302 — champs des modèles de notification (numérotation de l'annexe). */
export const DORA_ITS_FIELDS: DoraItsField[] = [
  f('1.1', 'GENERAL', 'Type of submission', 'text', false), f('1.2', 'GENERAL', 'Name of the entity submitting the report'),
  f('1.3', 'GENERAL', 'Identification code of the entity submitting the report'), f('1.4', 'GENERAL', 'Type of financial entity affected'),
  f('1.5', 'GENERAL', 'Name of the financial entity affected'), f('1.6', 'GENERAL', 'LEI code of the financial entity affected'),
  f('1.7', 'GENERAL', 'Primary contact person name'), f('1.8', 'GENERAL', 'Primary contact person email'), f('1.9', 'GENERAL', 'Primary contact person telephone'),
  f('1.10', 'GENERAL', 'Second contact person name'), f('1.11', 'GENERAL', 'Second contact person email'), f('1.12', 'GENERAL', 'Second contact person telephone'),
  f('1.13', 'GENERAL', 'Name of the ultimate parent undertaking'), f('1.14', 'GENERAL', 'LEI code of the ultimate parent undertaking'),
  f('1.15', 'GENERAL', 'Reporting currency', 'text', false),
  f('2.1', 'INITIAL', 'Incident reference code assigned by the financial entity', 'text', false),
  f('2.2', 'INITIAL', 'Date and time of detection of the major ICT-related incident', 'datetime', false),
  f('2.3', 'INITIAL', 'Date and time of classification of the ICT-related incident as major', 'datetime', false),
  f('2.4', 'INITIAL', 'Description of the major ICT-related incident'), f('2.5', 'INITIAL', 'Classification criteria that triggered the incident report', 'list'),
  f('2.6', 'INITIAL', "Materiality thresholds for the classification criterion 'Geographical spread'"), f('2.7', 'INITIAL', 'Discovery of the major ICT-related incident'),
  f('2.8', 'INITIAL', 'Indication whether the major ICT-related incident originates from a third-party provider or another financial entity'),
  f('2.9', 'INITIAL', 'Activation of business continuity plan, if activated'), f('2.10', 'INITIAL', 'Other relevant information'),
  f('3.1', 'INTERMEDIATE', 'Incident reference code provided by the competent authority'), f('3.2', 'INTERMEDIATE', 'Date and time of occurrence of the major ICT-related incident', 'datetime'),
  f('3.3', 'INTERMEDIATE', 'Date and time when services, activities or operations have been recovered', 'datetime'), f('3.4', 'INTERMEDIATE', 'Number of clients affected', 'number'),
  f('3.5', 'INTERMEDIATE', 'Percentage of clients affected', 'number'), f('3.6', 'INTERMEDIATE', 'Number of financial counterparts affected', 'number'),
  f('3.7', 'INTERMEDIATE', 'Percentage of financial counterparts affected', 'number'), f('3.8', 'INTERMEDIATE', 'Impact on relevant clients or financial counterparts'),
  f('3.9', 'INTERMEDIATE', 'Number of affected transactions', 'number'), f('3.10', 'INTERMEDIATE', 'Percentage of affected transactions', 'number'),
  f('3.11', 'INTERMEDIATE', 'Value of affected transactions', 'amount'), f('3.12', 'INTERMEDIATE', 'Information on whether the numbers are actual or estimates, or whether there has not been any impact'),
  f('3.13', 'INTERMEDIATE', 'Reputational impact', 'bool'), f('3.14', 'INTERMEDIATE', 'Contextual information about the reputational impact'),
  f('3.15', 'INTERMEDIATE', 'Duration of the major ICT-related incident', 'duration'), f('3.16', 'INTERMEDIATE', 'Service downtime', 'duration'),
  f('3.17', 'INTERMEDIATE', 'Information on whether the numbers for duration and service downtime are actual or estimates'),
  f('3.18', 'INTERMEDIATE', 'Types of impact in the Member States'), f('3.19', 'INTERMEDIATE', 'Description of how the major ICT-related incident has an impact in other Member States'),
  f('3.20', 'INTERMEDIATE', "Materiality thresholds for the classification criterion 'Data losses'"), f('3.21', 'INTERMEDIATE', 'Description of the data losses'),
  f('3.22', 'INTERMEDIATE', "Classification criterion 'Critical services affected'"), f('3.23', 'INTERMEDIATE', 'Type of the major ICT-related incident'),
  f('3.24', 'INTERMEDIATE', 'Other types of incidents'), f('3.25', 'INTERMEDIATE', 'Threats and techniques used by the threat actor'),
  f('3.26', 'INTERMEDIATE', 'Other types of techniques'), f('3.27', 'INTERMEDIATE', 'Information about affected functional areas and business processes'),
  f('3.28', 'INTERMEDIATE', 'Affected infrastructure components supporting business processes'), f('3.29', 'INTERMEDIATE', 'Information about affected infrastructure components supporting business processes'),
  f('3.30', 'INTERMEDIATE', 'Impact on the financial interest of clients'), f('3.31', 'INTERMEDIATE', 'Reporting to other authorities'),
  f('3.32', 'INTERMEDIATE', "Specification of 'other' authorities"), f('3.33', 'INTERMEDIATE', 'Temporary actions/measures taken or planned to be taken to recover from the incident'),
  f('3.34', 'INTERMEDIATE', 'Description of any temporary actions and measures taken or planned to be taken to recover from the incident'), f('3.35', 'INTERMEDIATE', 'Indicators of compromise'),
  f('4.1', 'FINAL', 'High-level classification of root causes of the incident'), f('4.2', 'FINAL', 'Detailed classification of root causes of the incident'),
  f('4.3', 'FINAL', 'Additional classification of root causes of the incident'), f('4.4', 'FINAL', 'Other types of root cause types'),
  f('4.5', 'FINAL', 'Information about the root causes of the incident'), f('4.6', 'FINAL', 'Incident resolution summary'),
  f('4.7', 'FINAL', 'Date and time when the incident root cause was addressed', 'datetime'), f('4.8', 'FINAL', 'Date and time when the incident was resolved', 'datetime'),
  f('4.9', 'FINAL', 'Information if the permanent resolution date of the incident differs from the initially planned implementation date'),
  f('4.10', 'FINAL', 'Assessment of risk to critical functions for resolution purposes'), f('4.11', 'FINAL', 'Information relevant for resolution authorities'),
  f('4.12', 'FINAL', "Materiality threshold for the classification criterion 'Economic impact'"), f('4.13', 'FINAL', 'Amount of gross direct and indirect costs and losses', 'amount'),
  f('4.14', 'FINAL', 'Amount of financial recoveries', 'amount'), f('4.15', 'FINAL', 'Information on whether the non-major incidents have been recurring'),
  f('4.16', 'FINAL', 'Date and time of occurrence of recurring incidents', 'datetime'),
]
const BY_ID = new Map(DORA_ITS_FIELDS.map(x => [x.id, x]))
const MAX_TEXT = 2000

export type DeclarationValue = string | number | boolean | string[]
export type Declaration = Record<string, DeclarationValue>

/** Compléments saisis : seuls les champs ITS éditables sont gardés ; texte borné, nombres reconnus, montants/durées en texte brut. */
export function cleanDeclaration(input: unknown): Declaration {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out: Declaration = {}
  for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
    const field = BY_ID.get(id)
    if (!field || !field.editable) continue
    if (field.kind === 'number' || field.kind === 'amount') {
      const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(',', '.').trim())
      if (String(raw ?? '').trim() !== '' && Number.isFinite(n) && n >= 0) out[id] = n
    } else if (field.kind === 'bool') {
      if (typeof raw === 'boolean') out[id] = raw
    } else if (field.kind === 'list') {
      const list = (Array.isArray(raw) ? raw : String(raw ?? '').split(/[;\n]/)).map(x => String(x).trim()).filter(Boolean).slice(0, 30)
      if (list.length) out[id] = list.map(x => x.slice(0, 200))
    } else {
      const t = String(raw ?? '').trim().slice(0, MAX_TEXT)
      if (t) out[id] = t
    }
  }
  return out
}

export interface DeclarationIncident {
  id: string; intitule: string; description?: string | null
  dateSurvenance?: Date | null; dateDetection?: Date | null; doraClasseMajeurLe?: Date | null
  doraCriteres?: DoraCriteres | null
  montantBrut?: number | null; recuperations?: number | null
  clotureLe?: Date | null; clotureCommentaire?: string | null
  causeRacine?: string | null; causeDetail?: string | null; typeEvenement?: string | null; statut?: string
}
export interface DeclarationContext { organisationNom: string; devise: string; now: Date }

/** Critères de classification (DORA art. 18) → valeurs de référence ACRA du champ 2.5 (« clients, contreparties et transactions » regroupés). */
const CRITERE_CODE: Record<DoraCritere, string> = {
  clients: 'clients_counterparts_transactions', transactions: 'clients_counterparts_transactions', reputation: 'reputational_impact',
  duree: 'duration_service_downtime', geo: 'geographical_spread', donnees: 'data_losses', serviceCritique: 'critical_services_affected', economique: 'economic_impact',
}
const iso = (d?: Date | null) => (d && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined)
const duree = (minutes?: number | null) => (typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0
  ? { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: Math.round(minutes % 60) } : undefined)
/** Montants en MILLIERS d'unités (ITS : précision minimale équivalente aux milliers ; instruction opérationnelle des AES). */
const milliers = (v?: number | null) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) / 1000 : undefined)

const STAGE_LABEL: Record<DoraStage, { submissionType: string; field11: string }> = {
  INITIAL: { submissionType: 'initial_notification', field11: 'Initial notification' },
  INTERMEDIATE: { submissionType: 'intermediate_report', field11: 'Intermediate report' },
  FINAL: { submissionType: 'final_report', field11: 'Final report' },
}

export interface DoraReportJson {
  schema: 'acra.dora-incident-report/1'; source: string; notice: string; generatedAt: string
  submissionType: string; stage: DoraStage
  fields: Record<string, DeclarationValue>
  /** Champs de l'étape (et généraux) sans valeur : à compléter ou à confirmer comme sans objet avant dépôt. */
  missing: string[]
  /** Indices ACRA non reportés tels quels (choix à faire dans les listes de l'ITS). */
  hints: { rootCause?: string; eventType?: string }
}

function derived(inc: DeclarationIncident, ctx: DeclarationContext): Declaration {
  const c = inc.doraCriteres ?? {}
  const d: Declaration = {}
  const set = (id: string, v: DeclarationValue | undefined) => { if (v !== undefined && v !== '') d[id] = v }
  set('1.2', ctx.organisationNom); set('1.5', ctx.organisationNom); set('1.15', ctx.devise)
  set('2.1', `ACRA-${inc.id}`); set('2.2', iso(inc.dateDetection)); set('2.3', iso(inc.doraClasseMajeurLe))
  set('2.4', [inc.intitule, inc.description].filter(Boolean).join(' — '))
  const criteres = [...new Set(criteresDeclenches(c).map(x => CRITERE_CODE[x]))]
  if (criteres.length) set('2.5', criteres)
  set('3.2', iso(inc.dateSurvenance))
  if (typeof c.clientsAffectes === 'number') set('3.4', c.clientsAffectes)
  if (typeof c.transactionsAffectees === 'number') set('3.9', c.transactionsAffectees)
  if (c.reputation !== undefined) set('3.13', c.reputation === true)
  const dur = duree(c.dureeIndispoMinutes); if (dur) { set('3.15', dur as unknown as DeclarationValue); set('3.16', dur as unknown as DeclarationValue) }
  if (c.serviceCritique === true) set('3.22', 'Critical services affected')
  if (c.pertesDonnees === true) set('3.20', 'Data losses')
  set('4.5', inc.causeDetail ?? undefined); set('4.6', inc.clotureCommentaire ?? undefined); set('4.8', iso(inc.clotureLe))
  set('4.13', milliers(inc.montantBrut)); set('4.14', milliers(inc.recuperations))
  return d
}

/** Fichier JSON d'une étape (initiale / intermédiaire / finale) : champs généraux + champs de l'étape, valeurs saisies prioritaires. */
export function buildDoraReportJson(inc: DeclarationIncident, stage: DoraStage, declaration: Declaration, ctx: DeclarationContext): DoraReportJson {
  const base = { ...derived(inc, ctx), ...cleanDeclaration(declaration) }
  base['1.1'] = STAGE_LABEL[stage].field11
  const fields: Record<string, DeclarationValue> = {}
  const missing: string[] = []
  for (const field of DORA_ITS_FIELDS) {
    if (field.stage !== 'GENERAL' && field.stage !== stage) continue
    const v = base[field.id]
    if (v === undefined) missing.push(field.id); else fields[field.id] = v
  }
  return {
    schema: 'acra.dora-incident-report/1', generatedAt: ctx.now.toISOString(),
    source: 'Règlement d’exécution (UE) 2025/302 de la Commission, annexe I (formulaires et modèles de notification des incidents majeurs liés aux TIC) ; DORA — Règlement (UE) 2022/2554, art. 19',
    notice: 'Aide à la déclaration : le canal, le format de dépôt et la langue sont fixés par l’autorité compétente (competent authority) ; ce fichier n’a pas été transmis. Vérifier chaque champ et les listes de choix de l’ITS avant dépôt.',
    submissionType: STAGE_LABEL[stage].submissionType, stage, fields, missing,
    hints: { ...(inc.causeRacine ? { rootCause: inc.causeRacine } : {}), ...(inc.typeEvenement ? { eventType: inc.typeEvenement } : {}) },
  }
}

export interface NotificationJsonInput {
  code: string; label?: string; autorite?: string
  phase: { code: string; label?: string }; echeance: Date | null; soumisLe: Date | null; reference?: string
}
export interface NotificationJson {
  schema: 'acra.incident-notification/1'; notice: string; generatedAt: string
  regime: { code: string; label?: string; authority?: string; phase: string; phaseLabel?: string; deadline: string | null; submittedAt: string | null; reference?: string }
  incident: { reference: string; title: string; description?: string; detectedAt?: string; occurredAt?: string; status?: string; eventType?: string; organisation: string; classifiedMajorAt?: string; closedAt?: string; resolutionSummary?: string; rootCause?: string; rootCauseDetail?: string }
}

/** Fichier JSON générique pour un régime autre que DORA (NIS2, CRA, RGPD, SEC 8-K, NYDFS, HIPAA, interne, personnalisé). */
export function buildNotificationJson(inc: DeclarationIncident, n: NotificationJsonInput, ctx: DeclarationContext): NotificationJson {
  return {
    schema: 'acra.incident-notification/1', generatedAt: ctx.now.toISOString(),
    notice: 'Aide à la déclaration : le contenu, le canal et le format de dépôt sont fixés par l’autorité ou le contrat concernés ; ce fichier n’a pas été transmis.',
    regime: { code: n.code, ...(n.label ? { label: n.label } : {}), ...(n.autorite ? { authority: n.autorite } : {}), phase: n.phase.code, ...(n.phase.label ? { phaseLabel: n.phase.label } : {}),
      deadline: iso(n.echeance) ?? null, submittedAt: iso(n.soumisLe) ?? null, ...(n.reference ? { reference: n.reference } : {}) },
    incident: {
      reference: `ACRA-${inc.id}`, title: inc.intitule, ...(inc.description ? { description: inc.description } : {}),
      ...(iso(inc.dateDetection) ? { detectedAt: iso(inc.dateDetection) } : {}), ...(iso(inc.dateSurvenance) ? { occurredAt: iso(inc.dateSurvenance) } : {}),
      ...(inc.statut ? { status: inc.statut } : {}), ...(inc.typeEvenement ? { eventType: inc.typeEvenement } : {}), organisation: ctx.organisationNom,
      ...(iso(inc.doraClasseMajeurLe) ? { classifiedMajorAt: iso(inc.doraClasseMajeurLe) } : {}), ...(iso(inc.clotureLe) ? { closedAt: iso(inc.clotureLe) } : {}),
      ...(inc.clotureCommentaire ? { resolutionSummary: inc.clotureCommentaire } : {}), ...(inc.causeRacine ? { rootCause: inc.causeRacine } : {}), ...(inc.causeDetail ? { rootCauseDetail: inc.causeDetail } : {}),
    },
  }
}
