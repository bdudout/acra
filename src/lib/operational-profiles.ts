/**
 * Profils opérationnels — socle métier neutre, sans accès DB.
 *
 * Le catalogue volontairement au niveau des fonctions/objectifs permet un premier
 * diagnostic fiable sans prétendre reproduire les publications NIST/NCSC. Les
 * organisations peuvent ensuite décliner chaque point avec leurs propres preuves,
 * actions et sous-exigences dans l'interface.
 */

export type OperationalProfileFramework = 'NIST_CSF_2_0' | 'NCSC_CAF_V4'
export type OperationalProfileStatus = 'NON_EVALUE' | 'COUVERT' | 'PARTIEL' | 'NON_COUVERT' | 'NON_APPLICABLE'

export interface OperationalProfileCatalogItem {
  ref: string
  label: string
  description: string
}

export interface OperationalProfileCatalog {
  framework: OperationalProfileFramework
  title: string
  version: string
  /** Niveau de lecture proposé par ACRA ; ce n'est pas une liste de contrôles exhaustive. */
  granularity: 'FUNCTION' | 'OBJECTIVE'
  sourceUrl: string
  items: OperationalProfileCatalogItem[]
}

export interface OperationalProfileEntry {
  ref: string
  statut: OperationalProfileStatus
  cible?: OperationalProfileStatus
  commentaire?: string
  responsable?: string
}

export const OPERATIONAL_PROFILE_STATUSES: OperationalProfileStatus[] = [
  'NON_EVALUE', 'COUVERT', 'PARTIEL', 'NON_COUVERT', 'NON_APPLICABLE',
]

export const OPERATIONAL_PROFILE_CATALOGS: Record<OperationalProfileFramework, OperationalProfileCatalog> = {
  NIST_CSF_2_0: {
    framework: 'NIST_CSF_2_0',
    title: 'NIST Cybersecurity Framework',
    version: 'NIST CSF 2.0',
    granularity: 'FUNCTION',
    sourceUrl: 'https://www.nist.gov/cyberframework',
    items: [
      { ref: 'GV', label: 'Govern', description: 'Gouvernance, stratégie, responsabilités et gestion du risque cyber.' },
      { ref: 'ID', label: 'Identify', description: 'Connaissance des actifs, dépendances, risques et priorités.' },
      { ref: 'PR', label: 'Protect', description: 'Mesures de protection adaptées au risque.' },
      { ref: 'DE', label: 'Detect', description: 'Détection des événements et anomalies cyber.' },
      { ref: 'RS', label: 'Respond', description: 'Réponse, coordination et communication face à un incident.' },
      { ref: 'RC', label: 'Recover', description: 'Rétablissement et amélioration après un incident.' },
    ],
  },
  NCSC_CAF_V4: {
    framework: 'NCSC_CAF_V4',
    title: 'NCSC Cyber Assessment Framework',
    version: 'NCSC CAF v4.0',
    granularity: 'OBJECTIVE',
    sourceUrl: 'https://www.ncsc.gov.uk/collection/cyber-assessment-framework',
    items: [
      { ref: 'A', label: 'Managing security risk', description: 'Gestion des risques, gouvernance, actifs et chaîne d’approvisionnement.' },
      { ref: 'B', label: 'Protecting against cyber attack', description: 'Protection contre les attaques cyber.' },
      { ref: 'C', label: 'Detecting cyber security events', description: 'Détection des événements de cybersécurité.' },
      { ref: 'D', label: 'Minimising the impact of cyber security incidents', description: 'Réponse et réduction de l’impact des incidents cyber.' },
    ],
  },
}

function isStatus(value: unknown): value is OperationalProfileStatus {
  return typeof value === 'string' && OPERATIONAL_PROFILE_STATUSES.includes(value as OperationalProfileStatus)
}

/** Nettoie une saisie client et écarte les références hors du catalogue sélectionné. */
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
    byRef.set(ref, { ref, statut: entry.statut, ...(cible ? { cible } : {}), ...(commentaire ? { commentaire } : {}), ...(responsable ? { responsable } : {}) })
  }
  return [...byRef.values()]
}

export function operationalProfileStats(entries: OperationalProfileEntry[]) {
  const total = entries.length
  const covered = entries.filter(entry => entry.statut === 'COUVERT').length
  const partial = entries.filter(entry => entry.statut === 'PARTIEL').length
  const notApplicable = entries.filter(entry => entry.statut === 'NON_APPLICABLE' || entry.cible === 'NON_APPLICABLE').length
  // Une cible explicitement non applicable ne constitue pas un écart à traiter,
  // même si l'état historique n'avait pas encore été qualifié ainsi.
  const gaps = entries.filter(entry => entry.cible !== 'NON_APPLICABLE' && (entry.statut === 'PARTIEL' || entry.statut === 'NON_COUVERT')).length
  const targetGaps = entries.filter(entry => entry.cible === 'COUVERT' && entry.statut !== 'COUVERT').length
  return { total, covered, partial, gaps, notApplicable, targetGaps }
}
