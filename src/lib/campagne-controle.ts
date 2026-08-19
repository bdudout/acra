// ─── Campagnes de contrôle de 1er niveau (N1) ────────────────────────────────
// Une campagne orchestre une VAGUE de contrôles à exécuter sur une période (dérivée
// du plan de contrôle / de la cartographie). Elle s'appuie sur le module M3 :
// les contrôles (bibliothèque) et leurs exécutions (ControleExecution). L'avancement
// se calcule à partir des exécutions tombant DANS la fenêtre de la campagne.
// Logique PURE et testée ; l'orchestration ne duplique pas les exécutions.

export const CAMPAGNE_CONTROLE_STATUTS = ['PLANIFIEE', 'EN_COURS', 'CLOTUREE'] as const
export type CampagneControleStatut = (typeof CAMPAGNE_CONTROLE_STATUTS)[number]

export const CAMPAGNE_NIVEAUX = ['N1', 'N2'] as const
export type CampagneNiveau = (typeof CAMPAGNE_NIVEAUX)[number]

export interface CampagneControleInput {
  intitule?: unknown
  description?: unknown
  dateDebut?: unknown
  dateFin?: unknown
  controleIds?: unknown
  niveau?: unknown
  statut?: unknown
}

export interface CleanCampagneControle {
  intitule: string
  description: string | null
  dateDebut: Date | null
  dateFin: Date | null
  controleIds: string[]
  niveau: CampagneNiveau
  statut: CampagneControleStatut
}

const DAY = 86_400_000

function parseDate(v: unknown): Date | null {
  if (v == null || v === '') return null
  const d = v instanceof Date ? v : new Date(v as string)
  return Number.isNaN(d.getTime()) ? null : d
}
const txt = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Renvoie un code d'erreur i18n, ou null si l'entrée est valide. */
export function validateCampagneControleInput(body: CampagneControleInput): string | null {
  if (typeof body.intitule !== 'string' || body.intitule.trim() === '') return 'intitule_requis'
  const d = parseDate(body.dateDebut)
  const f = parseDate(body.dateFin)
  if (body.dateDebut != null && body.dateDebut !== '' && !d) return 'date_invalide'
  if (body.dateFin != null && body.dateFin !== '' && !f) return 'date_invalide'
  if (d && f && f.getTime() < d.getTime()) return 'dates_incoherentes'
  return null
}

/** Normalise un corps de requête en campagne (identifiants dédupliqués, enums sûrs). */
export function cleanCampagneControleInput(body: CampagneControleInput): CleanCampagneControle {
  const ids = Array.isArray(body.controleIds)
    ? Array.from(new Set((body.controleIds as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim() !== '').map(s => s.trim())))
    : []
  const niveau = body.niveau === 'N2' ? 'N2' : 'N1'
  const statut = (CAMPAGNE_CONTROLE_STATUTS as readonly string[]).includes(body.statut as string) ? (body.statut as CampagneControleStatut) : 'PLANIFIEE'
  return {
    intitule: txt(body.intitule) ?? '',
    description: txt(body.description),
    dateDebut: parseDate(body.dateDebut),
    dateFin: parseDate(body.dateFin),
    controleIds: ids,
    niveau,
    statut,
  }
}

export interface ExecutionControleLite {
  controleId: string
  dateRealisation: Date | string
  resultat: string
}

export interface AvancementCampagne {
  total: number
  /** Contrôles du périmètre exécutés DANS la fenêtre. */
  faits: number
  aFaire: number
  /** Nombre d'exécutions en anomalie (dans le périmètre et la fenêtre). */
  anomalies: number
  /** Part d'avancement 0..1 (1 si le périmètre est vide). */
  tauxAvancement: number
}

function dansFenetre(d: Date | string, debut: Date | null, fin: Date | null): boolean {
  const dt = parseDate(d)
  if (!dt) return false
  if (debut && dt.getTime() < debut.getTime()) return false
  if (fin && dt.getTime() > fin.getTime() + DAY - 1) return false // fin INCLUSE (jour entier)
  return true
}

/** Avancement d'une campagne à partir des exécutions de contrôle. */
export function avancementCampagne(
  campagne: { controleIds: string[]; dateDebut?: Date | string | null; dateFin?: Date | string | null },
  executions: ExecutionControleLite[],
): AvancementCampagne {
  const debut = parseDate(campagne.dateDebut ?? null)
  const fin = parseDate(campagne.dateFin ?? null)
  const scope = new Set(campagne.controleIds)

  const faitsSet = new Set<string>()
  let anomalies = 0
  for (const e of executions) {
    if (!scope.has(e.controleId)) continue
    if (!dansFenetre(e.dateRealisation, debut, fin)) continue
    faitsSet.add(e.controleId)
    if (e.resultat === 'ANOMALIE') anomalies++
  }
  const total = campagne.controleIds.length
  const faits = faitsSet.size
  return { total, faits, aFaire: total - faits, anomalies, tauxAvancement: total ? faits / total : 1 }
}

/** Une campagne est en retard si sa date de fin est passée et l'avancement incomplet. */
export function campagneEnRetard(
  campagne: { dateFin?: Date | string | null },
  avancement: AvancementCampagne,
  maintenant: Date = new Date(),
): boolean {
  const fin = parseDate(campagne.dateFin ?? null)
  if (!fin) return false
  return maintenant.getTime() > fin.getTime() + DAY - 1 && avancement.tauxAvancement < 1
}
