// ─── Référentiel des entités (consolidation, lot E1) ──────────────────────────
// Fonctions pures : validation, hiérarchie, rapprochement d'un texte libre, règles de la source de vérité.
// Spec : docs/specs/entites-consolidation-besoin.md (décisions § 4).

/** Une filiale peut être une entité (éventuellement liée à une organisation ACRA) ; les services responsables des
 *  mesures en sont aussi (type SERVICE). */
export const TYPES_ENTITE = ['FILIALE', 'DIRECTION', 'SITE', 'SERVICE', 'AUTRE'] as const
export type TypeEntite = (typeof TYPES_ENTITE)[number]
export const SOURCES_ENTITE = ['MANUEL', 'IMPORT', 'ANNUAIRE'] as const
export type SourceEntite = (typeof SOURCES_ENTITE)[number]
export type SourceVerite = 'ACRA' | 'ANNUAIRE'

/** Historique des réorganisations conservé 5 ans. */
export const RETENTION_HISTORIQUE_ANS = 5

export const NOM_MAX = 120
const ALIAS_MAX = 20
const CODE_MAX = 64

export interface EntiteRef {
  id: string
  nom: string
  type: string
  alias: string[]
  codeExterne: string | null
  parentId: string | null
  source: string
  valideAu: Date | null
}

export function normaliserNom(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim()
}

export interface EntiteSaisie {
  nom: string; type: TypeEntite; alias: string[]; codeExterne: string | null; parentId: string | null
  organisationLieeId: string | null; valideDu: Date | null; valideAu: Date | null
}
type Resultat = { ok: true; entite: Partial<EntiteSaisie> } | { ok: false; error: string }

function date(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? undefined : d
}
const texteOuNull = (v: unknown, max: number): string | null => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : ''
  return s || null
}

/** Valide et nettoie une saisie. `partiel` : mise à jour, seuls les champs fournis sont renvoyés. */
export function nettoyerEntite(input: unknown, opts: { partiel?: boolean } = {}): Resultat {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const out: Partial<EntiteSaisie> = {}
  const fourni = (k: string) => !opts.partiel || k in o
  if (fourni('nom')) {
    const nom = typeof o.nom === 'string' ? o.nom.trim().replace(/\s+/g, ' ') : ''
    if (!nom) return { ok: false, error: 'nom_requis' }
    out.nom = nom.slice(0, NOM_MAX)
  }
  if (fourni('type')) {
    if (!TYPES_ENTITE.includes(o.type as TypeEntite)) return { ok: false, error: 'type_invalide' }
    out.type = o.type as TypeEntite
  }
  if (fourni('alias')) {
    const vus = new Set(out.nom ? [normaliserNom(out.nom)] : [])
    out.alias = []
    for (const a of Array.isArray(o.alias) ? o.alias : []) {
      if (typeof a !== 'string') continue
      const v = a.trim().replace(/\s+/g, ' ').slice(0, NOM_MAX); const n = normaliserNom(v)
      if (!n || vus.has(n)) continue
      vus.add(n); out.alias.push(v)
      if (out.alias.length >= ALIAS_MAX) break
    }
  }
  if (fourni('codeExterne')) out.codeExterne = texteOuNull(o.codeExterne, CODE_MAX)
  if (fourni('parentId')) out.parentId = texteOuNull(o.parentId, 64)
  if (fourni('organisationLieeId')) out.organisationLieeId = texteOuNull(o.organisationLieeId, 64)
  for (const k of ['valideDu', 'valideAu'] as const) {
    if (!fourni(k)) continue
    const d = o[k] === undefined ? null : date(o[k])
    if (d === undefined) return { ok: false, error: 'dates_invalides' }
    out[k] = d
  }
  if (out.valideDu && out.valideAu && out.valideAu < out.valideDu) return { ok: false, error: 'dates_invalides' }
  return { ok: true, entite: out }
}

/** Rattacher `id` à `parentId` créerait-il une boucle (soi-même ou un descendant) ? */
export function creeraitUnCycle(entites: Pick<EntiteRef, 'id' | 'parentId'>[], id: string, parentId: string | null): boolean {
  const parents = new Map(entites.map(x => [x.id, x.parentId]))
  let courant = parentId
  for (let i = 0; courant && i <= entites.length; i++) {
    if (courant === id) return true
    courant = parents.get(courant) ?? null
  }
  return false
}

export function estActive(e: Pick<EntiteRef, 'valideAu'>, ref: Date = new Date()): boolean {
  return !e.valideAu || e.valideAu > ref
}

// Coefficient de Dice sur les bigrammes : robuste aux fautes de frappe et aux pluriels.
function bigrammes(s: string): Map<string, number> {
  const m = new Map<string, number>(); const t = s.replace(/ /g, '')
  for (let i = 0; i < t.length - 1; i++) { const b = t.slice(i, i + 2); m.set(b, (m.get(b) ?? 0) + 1) }
  return m
}
function dice(a: string, b: string): number {
  if (a === b) return 1
  const A = bigrammes(a), B = bigrammes(b)
  const total = [...A.values()].reduce((x, y) => x + y, 0) + [...B.values()].reduce((x, y) => x + y, 0)
  if (!total) return 0
  let commun = 0
  for (const [k, n] of A) commun += Math.min(n, B.get(k) ?? 0)
  return (2 * commun) / total
}

export const SEUIL_SIMILARITE = 0.75
export interface Correspondance { id: string; nom: string; score: number; motif: 'NOM' | 'ALIAS' | 'CODE' }

/** Entités du référentiel qui correspondent à un texte libre, de la plus proche à la moins proche. */
export function correspondances(texte: string, entites: EntiteRef[], seuil = SEUIL_SIMILARITE): Correspondance[] {
  const t = normaliserNom(texte)
  if (!t) return []
  const out: Correspondance[] = []
  for (const e of entites) {
    let best: Correspondance | null = null
    const garder = (score: number, motif: Correspondance['motif']) => { if (!best || score > best.score) best = { id: e.id, nom: e.nom, score, motif } }
    if (e.codeExterne && normaliserNom(e.codeExterne) === t) garder(1, 'CODE')
    garder(dice(t, normaliserNom(e.nom)), 'NOM')
    for (const a of e.alias) garder(dice(t, normaliserNom(a)), 'ALIAS')
    const b = best as Correspondance | null
    if (b && b.score >= seuil) out.push({ ...b, score: Math.round(b.score * 100) / 100 })
  }
  return out.sort((a, b) => b.score - a.score || a.nom.localeCompare(b.nom))
}

/** Champs non modifiables dans ACRA quand l'annuaire fait foi (entités venues de l'annuaire seulement). */
export function champsVerrouilles(e: Pick<EntiteRef, 'source'>, sourceVerite: SourceVerite): ('nom' | 'codeExterne' | 'parentId')[] {
  return sourceVerite === 'ANNUAIRE' && e.source === 'ANNUAIRE' ? ['nom', 'codeExterne', 'parentId'] : []
}

/** Choix de l'administrateur, stocké avec la configuration du connecteur ; ACRA fait foi par défaut. */
export function sourceVeriteDe(syncConfig: unknown): SourceVerite {
  const v = syncConfig && typeof syncConfig === 'object' ? (syncConfig as { sourceVerite?: unknown }).sourceVerite : undefined
  return v === 'ANNUAIRE' ? 'ANNUAIRE' : 'ACRA'
}

export interface NoeudEntite<T extends EntiteRef = EntiteRef> { entite: T; enfants: NoeudEntite<T>[] }

/** Hiérarchie triée par nom ; une entité dont le parent est absent remonte à la racine. */
export function construireArbre<T extends EntiteRef>(entites: T[]): NoeudEntite<T>[] {
  const noeuds = new Map(entites.map(e => [e.id, { entite: e, enfants: [] as NoeudEntite<T>[] }]))
  const racines: NoeudEntite<T>[] = []
  for (const n of noeuds.values()) {
    const p = n.entite.parentId ? noeuds.get(n.entite.parentId) : undefined
    if (p && p !== n) p.enfants.push(n); else racines.push(n)
  }
  const trier = (l: NoeudEntite<T>[]) => { l.sort((a, b) => a.entite.nom.localeCompare(b.entite.nom)); l.forEach(n => trier(n.enfants)) }
  trier(racines)
  return racines
}

export function dateLimiteHistorique(ref: Date = new Date()): Date {
  const d = new Date(ref); d.setUTCFullYear(d.getUTCFullYear() - RETENTION_HISTORIQUE_ANS)
  return d
}
