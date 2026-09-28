/**
 * Profils opérationnels US/UK — socle métier PUR, sans accès DB.
 *
 * Deux cadres de référence, au niveau où une organisation pilote réellement :
 *  - NIST Cybersecurity Framework 2.0 : 22 catégories réparties dans les 6
 *    fonctions (libellés et énoncés repris de l'export officiel NIST CSF 2.0) ;
 *    niveau cible = Tier 1 à 4 (Partial, Risk Informed, Repeatable, Adaptive).
 *  - NCSC Cyber Assessment Framework v4.0 : 14 principes répartis dans les 4
 *    objectifs A–D (énoncés officiels NCSC) ; niveau cible = Basic Profile ou
 *    Enhanced Profile.
 * Les textes normatifs restent dans leur forme officielle (anglais) ; seule
 * l'interface est traduite. Ce module ne prétend à aucune certification : il
 * outille une auto-évaluation état courant / état cible et sa traçabilité.
 */

export type OperationalProfileFramework = 'NIST_CSF_2_0' | 'NCSC_CAF_V4'
export type OperationalProfileStatus = 'NON_EVALUE' | 'COUVERT' | 'PARTIEL' | 'NON_COUVERT' | 'NON_APPLICABLE'

export interface OperationalProfileCatalogGroup { ref: string; label: string; description: string }
export interface OperationalProfileCatalogItem { ref: string; group: string; label: string; description: string }
export interface OperationalProfileTargetLevel { value: string; label: string }

export interface OperationalProfileCatalog {
  framework: OperationalProfileFramework
  title: string
  /** Version citée du référentiel (règle ACRA : toujours citer la version). */
  version: string
  granularity: 'CATEGORY' | 'PRINCIPLE'
  sourceUrl: string
  groups: OperationalProfileCatalogGroup[]
  items: OperationalProfileCatalogItem[]
  /** Niveaux cibles du profil (Tiers CSF, profils CAF), libellés officiels. */
  targetLevels: OperationalProfileTargetLevel[]
}

export interface OperationalProfileEntry {
  ref: string
  statut: OperationalProfileStatus
  cible?: OperationalProfileStatus
  commentaire?: string
  responsable?: string
  /** Horodatage serveur de la dernière modification de CE point (ISO 8601). */
  updatedAt?: string
  updatedById?: string
}

export const OPERATIONAL_PROFILE_FRAMEWORKS: OperationalProfileFramework[] = ['NIST_CSF_2_0', 'NCSC_CAF_V4']
export const OPERATIONAL_PROFILE_STATUSES: OperationalProfileStatus[] = [
  'NON_EVALUE', 'COUVERT', 'PARTIEL', 'NON_COUVERT', 'NON_APPLICABLE',
]

export const isOperationalProfileFramework = (v: unknown): v is OperationalProfileFramework =>
  typeof v === 'string' && (OPERATIONAL_PROFILE_FRAMEWORKS as string[]).includes(v)

export const OPERATIONAL_PROFILE_CATALOGS: Record<OperationalProfileFramework, OperationalProfileCatalog> = {
  NIST_CSF_2_0: {
    framework: 'NIST_CSF_2_0',
    title: 'NIST Cybersecurity Framework',
    version: 'NIST CSF 2.0',
    granularity: 'CATEGORY',
    sourceUrl: 'https://www.nist.gov/cyberframework',
    groups: [
      { ref: 'GV', label: 'Govern', description: 'The organization\'s cybersecurity risk management strategy, expectations, and policy are established, communicated, and monitored' },
      { ref: 'ID', label: 'Identify', description: 'The organization\'s current cybersecurity risks are understood' },
      { ref: 'PR', label: 'Protect', description: 'Safeguards to manage the organization\'s cybersecurity risks are used' },
      { ref: 'DE', label: 'Detect', description: 'Possible cybersecurity attacks and compromises are found and analyzed' },
      { ref: 'RS', label: 'Respond', description: 'Actions regarding a detected cybersecurity incident are taken' },
      { ref: 'RC', label: 'Recover', description: 'Assets and operations affected by a cybersecurity incident are restored' },
    ],
    items: [
      { ref: 'GV.OC', group: 'GV', label: 'Organizational Context', description: 'The circumstances - mission, stakeholder expectations, dependencies, and legal, regulatory, and contractual requirements - surrounding the organization\'s cybersecurity risk management decisions are understood' },
      { ref: 'GV.RM', group: 'GV', label: 'Risk Management Strategy', description: 'The organization\'s priorities, constraints, risk tolerance and appetite statements, and assumptions are established, communicated, and used to support operational risk decisions' },
      { ref: 'GV.RR', group: 'GV', label: 'Roles, Responsibilities, and Authorities', description: 'Cybersecurity roles, responsibilities, and authorities to foster accountability, performance assessment, and continuous improvement are established and communicated' },
      { ref: 'GV.PO', group: 'GV', label: 'Policy', description: 'Organizational cybersecurity policy is established, communicated, and enforced' },
      { ref: 'GV.OV', group: 'GV', label: 'Oversight', description: 'Results of organization-wide cybersecurity risk management activities and performance are used to inform, improve, and adjust the risk management strategy' },
      { ref: 'GV.SC', group: 'GV', label: 'Cybersecurity Supply Chain Risk Management', description: 'Cyber supply chain risk management processes are identified, established, managed, monitored, and improved by organizational stakeholders' },
      { ref: 'ID.AM', group: 'ID', label: 'Asset Management', description: 'Assets (e.g., data, hardware, software, systems, facilities, services, people) that enable the organization to achieve business purposes are identified and managed consistent with their relative importance to organizational objectives and the organization\'s risk strategy' },
      { ref: 'ID.RA', group: 'ID', label: 'Risk Assessment', description: 'The cybersecurity risk to the organization, assets, and individuals is understood by the organization' },
      { ref: 'ID.IM', group: 'ID', label: 'Improvement', description: 'Improvements to organizational cybersecurity risk management processes, procedures and activities are identified across all CSF Functions' },
      { ref: 'PR.AA', group: 'PR', label: 'Identity Management, Authentication, and Access Control', description: 'Access to physical and logical assets is limited to authorized users, services, and hardware and managed commensurate with the assessed risk of unauthorized access' },
      { ref: 'PR.AT', group: 'PR', label: 'Awareness and Training', description: 'The organization\'s personnel are provided with cybersecurity awareness and training so that they can perform their cybersecurity-related tasks' },
      { ref: 'PR.DS', group: 'PR', label: 'Data Security', description: 'Data are managed consistent with the organization\'s risk strategy to protect the confidentiality, integrity, and availability of information' },
      { ref: 'PR.PS', group: 'PR', label: 'Platform Security', description: 'The hardware, software (e.g., firmware, operating systems, applications), and services of physical and virtual platforms are managed consistent with the organization\'s risk strategy to protect their confidentiality, integrity, and availability' },
      { ref: 'PR.IR', group: 'PR', label: 'Technology Infrastructure Resilience', description: 'Security architectures are managed with the organization\'s risk strategy to protect asset confidentiality, integrity, and availability, and organizational resilience' },
      { ref: 'DE.CM', group: 'DE', label: 'Continuous Monitoring', description: 'Assets are monitored to find anomalies, indicators of compromise, and other potentially adverse events' },
      { ref: 'DE.AE', group: 'DE', label: 'Adverse Event Analysis', description: 'Anomalies, indicators of compromise, and other potentially adverse events are analyzed to characterize the events and detect cybersecurity incidents' },
      { ref: 'RS.MA', group: 'RS', label: 'Incident Management', description: 'Responses to detected cybersecurity incidents are managed' },
      { ref: 'RS.AN', group: 'RS', label: 'Incident Analysis', description: 'Investigations are conducted to ensure effective response and support forensics and recovery activities' },
      { ref: 'RS.CO', group: 'RS', label: 'Incident Response Reporting and Communication', description: 'Response activities are coordinated with internal and external stakeholders as required by laws, regulations, or policies' },
      { ref: 'RS.MI', group: 'RS', label: 'Incident Mitigation', description: 'Activities are performed to prevent expansion of an event and mitigate its effects' },
      { ref: 'RC.RP', group: 'RC', label: 'Incident Recovery Plan Execution', description: 'Restoration activities are performed to ensure operational availability of systems and services affected by cybersecurity incidents' },
      { ref: 'RC.CO', group: 'RC', label: 'Incident Recovery Communication', description: 'Restoration activities are coordinated with internal and external parties' },
    ],
    targetLevels: [
      { value: 'TIER_1', label: 'Tier 1: Partial' },
      { value: 'TIER_2', label: 'Tier 2: Risk Informed' },
      { value: 'TIER_3', label: 'Tier 3: Repeatable' },
      { value: 'TIER_4', label: 'Tier 4: Adaptive' },
    ],
  },
  NCSC_CAF_V4: {
    framework: 'NCSC_CAF_V4',
    title: 'NCSC Cyber Assessment Framework',
    version: 'NCSC CAF v4.0',
    granularity: 'PRINCIPLE',
    sourceUrl: 'https://www.ncsc.gov.uk/collection/cyber-assessment-framework',
    groups: [
      { ref: 'A', label: 'Managing security risk', description: 'Appropriate organisational structures, policies, processes, and procedures in place to understand, assess and systematically manage security risks to network and information systems supporting essential functions.' },
      { ref: 'B', label: 'Protecting against cyber attacks', description: 'Proportionate security measures are in place to protect the networks and information systems supporting essential functions from cyber attack.' },
      { ref: 'C', label: 'Detecting cyber security events', description: 'Capabilities exist to ensure security defences remain effective and to detect cyber security events affecting, or with the potential to affect, essential functions.' },
      { ref: 'D', label: 'Minimising the impact of cyber security incidents', description: 'Capabilities exist to minimise the adverse impact of a cyber security incident on the operation of essential function(s), including the restoration of those function(s) where necessary.' },
    ],
    items: [
      { ref: 'A1', group: 'A', label: 'Governance', description: 'The organisation has appropriate management policies, processes and procedures in place to govern its approach to the security of network and information systems.' },
      { ref: 'A2', group: 'A', label: 'Risk Management', description: 'The organisation takes appropriate steps to identify, assess and understand security risks to network and information systems supporting the operation of essential functions.' },
      { ref: 'A3', group: 'A', label: 'Asset Management', description: 'Everything required to deliver, maintain or support networks and information systems necessary for the operation of essential functions is determined and understood.' },
      { ref: 'A4', group: 'A', label: 'Supply Chain', description: 'The organisation understands and manages security risks to networks and information systems supporting the operation of essential functions that arise as a result of dependencies on suppliers.' },
      { ref: 'B1', group: 'B', label: 'Service protection policies, processes and procedures', description: 'The organisation defines, implements, communicates and enforces appropriate policies, processes and procedures that direct its overall approach to securing systems and data that support the operation of essential functions.' },
      { ref: 'B2', group: 'B', label: 'Identity and Access Control', description: 'The organisation understands, documents and manages access to networks and information systems and supporting the operation of essential functions.' },
      { ref: 'B3', group: 'B', label: 'Data security', description: 'Data stored or transmitted electronically is protected from actions such as unauthorised access, modification, or deletion that may cause an adverse impact on essential functions.' },
      { ref: 'B4', group: 'B', label: 'System security', description: 'Network and information systems and technology critical for the operation of essential functions are protected from cyber attack.' },
      { ref: 'B5', group: 'B', label: 'Resilient networks and systems', description: 'The organisation builds resilience against cyber attack and system failure into the design, implementation, operation and management of systems that support the operation of your essential function(s).' },
      { ref: 'B6', group: 'B', label: 'Staff awareness and training', description: 'Staff have appropriate awareness, knowledge and skills to carry out their organisational roles effectively in relation to the security of network and information systems supporting the operation of your essential function(s).' },
      { ref: 'C1', group: 'C', label: 'Security monitoring', description: 'The organisation monitors the security status of network and information systems supporting the operation of essential function(s) in order to detect security events indicative of a security incident.' },
      { ref: 'C2', group: 'C', label: 'Threat Hunting', description: 'The organisation proactively seeks to detect, within networks and information systems, adverse activity affecting, or with the potential to affect, the operation of essential functions even when the activity evades standard security prevent/detect solutions (or when standard solutions are not deployable).' },
      { ref: 'D1', group: 'D', label: 'Response and recovery planning', description: 'There are well-defined and tested incident management processes in place, that aim to ensure continuity of essential function(s) in the event of system or service failure.' },
      { ref: 'D2', group: 'D', label: 'Lessons Learned', description: 'When an incident occurs, steps are taken to understand its causes and to ensure remediating action is taken to protect against future incidents.' },
    ],
    targetLevels: [
      { value: 'BASIC', label: 'Basic Profile' },
      { value: 'ENHANCED', label: 'Enhanced Profile' },
    ],
  },
}

export function isOperationalProfileTarget(framework: OperationalProfileFramework, value: unknown): value is string {
  return typeof value === 'string' && OPERATIONAL_PROFILE_CATALOGS[framework].targetLevels.some(t => t.value === value)
}

function isStatus(value: unknown): value is OperationalProfileStatus {
  return typeof value === 'string' && OPERATIONAL_PROFILE_STATUSES.includes(value as OperationalProfileStatus)
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/

/**
 * Nettoie une liste d'entrées (saisie client ou JSON stocké) : références hors
 * catalogue et statuts inconnus écartés, champs bornés, dernière occurrence
 * retenue. Les métadonnées d'horodatage sont conservées si bien formées ; côté
 * écriture, `applyOperationalProfileUpdate` les recalcule (non forgeables).
 */
export function sanitizeOperationalProfileEntries(framework: OperationalProfileFramework, input: unknown): OperationalProfileEntry[] {
  if (!Array.isArray(input)) return []
  const knownRefs = new Set(OPERATIONAL_PROFILE_CATALOGS[framework].items.map(item => item.ref))
  const byRef = new Map<string, OperationalProfileEntry>()
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const entry = raw as Record<string, unknown>
    const ref = typeof entry.ref === 'string' ? entry.ref.trim() : ''
    if (!knownRefs.has(ref) || !isStatus(entry.statut)) continue
    const cible = isStatus(entry.cible) ? entry.cible : undefined
    const commentaire = typeof entry.commentaire === 'string' ? entry.commentaire.trim().slice(0, 2000) : undefined
    const responsable = typeof entry.responsable === 'string' ? entry.responsable.trim().slice(0, 120) : undefined
    const updatedAt = typeof entry.updatedAt === 'string' && ISO_DATE.test(entry.updatedAt) ? entry.updatedAt : undefined
    const updatedById = typeof entry.updatedById === 'string' && entry.updatedById.trim() ? entry.updatedById.trim().slice(0, 64) : undefined
    byRef.set(ref, {
      ref, statut: entry.statut,
      ...(cible ? { cible } : {}), ...(commentaire ? { commentaire } : {}), ...(responsable ? { responsable } : {}),
      ...(updatedAt ? { updatedAt } : {}), ...(updatedById ? { updatedById } : {}),
    })
  }
  return [...byRef.values()]
}

const TRACKED_FIELDS = ['statut', 'cible', 'responsable', 'commentaire'] as const
type TrackedField = (typeof TRACKED_FIELDS)[number]
export interface OperationalProfileChange { ref: string; fields: Partial<Record<TrackedField, [string | null, string | null]>> }

/**
 * Fusionne une saisie (déjà nettoyée) dans l'état stocké : seuls les points
 * réellement modifiés sont horodatés (updatedAt/updatedById côté serveur) ; les
 * points absents de la saisie sont conservés. Renvoie aussi le diff par champ,
 * journalisé pour l'historique (qui a changé quoi, de quoi vers quoi).
 */
export function applyOperationalProfileUpdate(
  previous: OperationalProfileEntry[],
  incoming: OperationalProfileEntry[],
  meta: { userId: string; now: Date },
): { entries: OperationalProfileEntry[]; changes: OperationalProfileChange[] } {
  const byRef = new Map(previous.map(e => [e.ref, e]))
  const changes: OperationalProfileChange[] = []
  for (const next of incoming) {
    const old = byRef.get(next.ref)
    const fields: OperationalProfileChange['fields'] = {}
    for (const f of TRACKED_FIELDS) {
      const a = old?.[f] ?? null
      const b = next[f] ?? null
      if (a !== b) fields[f] = [a, b]
    }
    if (Object.keys(fields).length === 0) continue
    const { updatedAt: _a, updatedById: _b, ...clean } = next
    void _a; void _b
    byRef.set(next.ref, { ...clean, updatedAt: meta.now.toISOString(), updatedById: meta.userId })
    changes.push({ ref: next.ref, fields })
  }
  return { entries: [...byRef.values()], changes }
}

/** Écart à traiter : partiel ou non couvert, sauf si la cible est « non applicable ». */
export function isActionableGap(entry: Pick<OperationalProfileEntry, 'statut' | 'cible'>): boolean {
  return entry.cible !== 'NON_APPLICABLE' && (entry.statut === 'PARTIEL' || entry.statut === 'NON_COUVERT')
}

export interface OperationalProfileStats {
  total: number
  assessed: number
  covered: number
  partial: number
  gaps: number
  notApplicable: number
  targetGaps: number
  /** % de points couverts parmi les points évalués et applicables (arrondi). */
  coverage: number
  lastReviewedAt: string | null
}

/** Synthèse d'un profil ; `total` = taille du catalogue (points non évalués inclus). */
export function operationalProfileStats(entries: OperationalProfileEntry[], total: number): OperationalProfileStats {
  const assessedEntries = entries.filter(e => e.statut !== 'NON_EVALUE')
  const notApplicable = entries.filter(e => e.statut === 'NON_APPLICABLE' || e.cible === 'NON_APPLICABLE').length
  const applicable = assessedEntries.filter(e => e.statut !== 'NON_APPLICABLE' && e.cible !== 'NON_APPLICABLE')
  const covered = entries.filter(e => e.statut === 'COUVERT').length
  const coveredApplicable = applicable.filter(e => e.statut === 'COUVERT').length
  const dates = entries.map(e => e.updatedAt).filter((d): d is string => !!d).sort()
  return {
    total,
    assessed: assessedEntries.length,
    covered,
    partial: entries.filter(e => e.statut === 'PARTIEL').length,
    gaps: entries.filter(isActionableGap).length,
    notApplicable,
    targetGaps: entries.filter(e => e.cible === 'COUVERT' && e.statut !== 'COUVERT').length,
    coverage: applicable.length ? Math.round((coveredApplicable / applicable.length) * 100) : 0,
    lastReviewedAt: dates.length ? dates[dates.length - 1] : null,
  }
}

/**
 * Lignes d'export du bilan (hors en-tête) : un point du catalogue par ligne,
 * points non évalués inclus. Colonnes : groupe, réf., libellé officiel, état
 * courant, état cible, responsable, justification, dernière modification.
 * La neutralisation des formules est faite à la sérialisation (toCsvCell).
 */
export function operationalProfileCsvRows(
  framework: OperationalProfileFramework,
  entries: OperationalProfileEntry[],
  statusLabel: (s: OperationalProfileStatus) => string,
): string[][] {
  const byRef = new Map(entries.map(e => [e.ref, e]))
  return OPERATIONAL_PROFILE_CATALOGS[framework].items.map(item => {
    const e = byRef.get(item.ref)
    return [
      item.group, item.ref, item.label,
      statusLabel(e?.statut ?? 'NON_EVALUE'), e?.cible ? statusLabel(e.cible) : '',
      e?.responsable ?? '', e?.commentaire ?? '', e?.updatedAt ?? '',
    ]
  })
}

export interface OperationalProfileActionSummary { total: number; open: number; overdue: number }

/**
 * Compte, par point de profil (`${profileId}|${ref}`), les plans d'action liés
 * (lien OPERATIONAL_PROFILE) : total, ouverts (statut ≠ FAIT) et en retard
 * (ouverts dont l'échéance est passée — le retard n'est jamais stocké).
 */
export function summarizeOperationalProfileActions(
  rows: { statut: string; echeance: Date | null; liens: { targetId: string; ref: string | null }[] }[],
  now: Date,
): Map<string, OperationalProfileActionSummary> {
  const out = new Map<string, OperationalProfileActionSummary>()
  for (const row of rows) {
    const open = row.statut !== 'FAIT'
    const overdue = open && !!row.echeance && row.echeance.getTime() < now.getTime()
    for (const lien of row.liens) {
      if (!lien.ref) continue
      const key = `${lien.targetId}|${lien.ref}`
      const s = out.get(key) ?? { total: 0, open: 0, overdue: 0 }
      s.total += 1
      if (open) s.open += 1
      if (overdue) s.overdue += 1
      out.set(key, s)
    }
  }
  return out
}
