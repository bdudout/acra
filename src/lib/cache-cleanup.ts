// ─── Nettoyage du cache « sans impact » (PUR) — docs/specs/stockage-supervision-nettoyage.md, lot B ───
// Une donnée est « sans impact » si elle est expirée, consommée ou régénérable, et que sa suppression ne change ni le
// comportement visible, ni une donnée métier, ni la traçabilité. Chaque règle porte un délai de grâce après l'expiration
// (horloges décalées, enquêtes immédiates). Cette lib ne fait AUCUNE requête : elle produit des filtres Prisma.

const H = 3600_000
const D = 24 * H

export type CleanupId = 'B1' | 'B2' | 'B3' | 'B4' | 'B5' | 'B6' | 'B7' | 'B8'
export interface CleanupCategory {
  id: CleanupId
  /** Nom du délégué Prisma (`prisma[model]`). */
  model: 'passwordResetToken' | 'verificationToken' | 'mfaChallenge' | 'session' | 'trustedDevice' | 'orgInvitation' | 'webhookDelivery' | 'analysisImport'
  /** Colonne identifiant (suppression par lots d'identifiants). */
  idField: 'id' | 'token'
  /** Sélectionnée par défaut dans le nettoyage automatique. */
  auto: boolean
  /** Taille moyenne estimée d'une ligne (octets) — ordre de grandeur pour l'aperçu. */
  avgRowBytes: number
  where: (now: Date) => Record<string, unknown>
}

const ago = (now: Date, ms: number) => new Date(now.getTime() - ms)

export const CLEANUP_CATEGORIES: readonly CleanupCategory[] = [
  { id: 'B1', model: 'passwordResetToken', idField: 'id', auto: true, avgRowBytes: 200, where: n => ({ OR: [{ usedAt: { lt: ago(n, 24 * H) } }, { expiresAt: { lt: ago(n, 24 * H) } }] }) },
  { id: 'B2', model: 'verificationToken', idField: 'token', auto: true, avgRowBytes: 150, where: n => ({ expires: { lt: ago(n, 24 * H) } }) },
  { id: 'B3', model: 'mfaChallenge', idField: 'id', auto: true, avgRowBytes: 250, where: n => ({ OR: [{ consumedAt: { lt: ago(n, H) } }, { expiresAt: { lt: ago(n, H) } }] }) },
  { id: 'B4', model: 'session', idField: 'id', auto: true, avgRowBytes: 200, where: n => ({ expires: { lt: ago(n, 24 * H) } }) },
  { id: 'B5', model: 'trustedDevice', idField: 'id', auto: true, avgRowBytes: 250, where: n => ({ expiresAt: { lt: ago(n, 7 * D) } }) },
  { id: 'B6', model: 'orgInvitation', idField: 'id', auto: true, avgRowBytes: 300, where: n => ({ acceptedAt: null, expiresAt: { lt: ago(n, 30 * D) } }) },
  // Jamais EN_ATTENTE : une livraison à rejouer ne doit pas disparaître.
  { id: 'B7', model: 'webhookDelivery', idField: 'id', auto: true, avgRowBytes: 2048, where: n => ({ OR: [{ statut: 'LIVRE', createdAt: { lt: ago(n, 30 * D) } }, { statut: 'ECHEC', createdAt: { lt: ago(n, 90 * D) } }] }) },
  // Accusés d'import : lisibles via GET /api/v2/analysis-imports/{id} → hors du nettoyage automatique (à cocher explicitement).
  { id: 'B8', model: 'analysisImport', idField: 'id', auto: false, avgRowBytes: 4096, where: n => ({ createdAt: { lt: ago(n, 30 * D) } }) },
]

/** Modèles qu'AUCUNE règle ne doit jamais toucher (liste figée, vérifiée par test). */
export const NEVER_CLEANED_MODELS = ['AuditLog', 'Analyse', 'Risque', 'PlanAction', 'Organization', 'User', 'Document', 'ConformiteSnapshot', 'AppetenceSnapshot', 'RapportEdition', 'McpProposal', 'InstanceEvent'] as const

export const defaultAutoCategories = (): CleanupId[] => CLEANUP_CATEGORIES.filter(c => c.auto).map(c => c.id)

/** Liste d'identifiants de catégories assainie (inconnus écartés, dédoublonnée). Valeur non-tableau → défaut. */
export function sanitizeCategories(raw: unknown): CleanupId[] {
  if (!Array.isArray(raw)) return defaultAutoCategories()
  const known = new Set<string>(CLEANUP_CATEGORIES.map(c => c.id))
  return [...new Set(raw.filter((x): x is CleanupId => typeof x === 'string' && known.has(x)))]
}

export interface CleanupPlanItem { id: CleanupId; model: CleanupCategory['model']; idField: CleanupCategory['idField']; avgRowBytes: number; where: Record<string, unknown> }

/** Filtre Prisma de chaque catégorie sélectionnée (ordre du catalogue). Sans sélection : le défaut automatique. */
export function planCleanup(now: Date, categories: CleanupId[] = CLEANUP_CATEGORIES.map(c => c.id)): CleanupPlanItem[] {
  const wanted = new Set(categories)
  return CLEANUP_CATEGORIES.filter(c => wanted.has(c.id)).map(c => ({ id: c.id, model: c.model, idField: c.idField, avgRowBytes: c.avgRowBytes, where: c.where(now) }))
}
