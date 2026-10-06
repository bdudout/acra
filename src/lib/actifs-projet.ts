// ─── Données et services d'un projet 360, avec leur criticité — PUR ──────────
// Tableau saisi en phase 2 (qualification) : ce que le projet manipule ou rend (données, services) et leur niveau de
// criticité (1 à 4). Stocké dans Cadrage.valeursMetier de l'analyse projet. Import possible depuis les valeurs métier
// d'une analyse cyber : information → donnée, processus → service, criticité = besoin DICT le plus élevé, sinon la
// gravité des événements redoutés. Fusion sans doublon d'intitulé : une ligne saisie n'est jamais écrasée.
// Testé : actifs-projet.test.ts.

export const ACTIF_TYPES = ['DONNEE', 'SERVICE'] as const
export type ActifType = (typeof ACTIF_TYPES)[number]
export const ACTIFS_MAX = 100
export const CRITICITE_MAX = 4
const CRITICITE_DEFAUT = 2

export interface ActifProjet { id: string; nom: string; type: ActifType; criticite: number; description?: string; source?: string }

/** Criticité bornée à [1, 4] ; absente ou illisible → 2. */
const borne = (v: unknown) => {
  const n = v == null || v === '' ? NaN : Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(CRITICITE_MAX, Math.max(1, n)) : CRITICITE_DEFAUT
}
const texte = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const normaliser = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
let seq = 0
const nouvelId = () => `ap${Date.now().toString(36)}${(seq++).toString(36)}`

export function sanitizeActifsProjet(input: unknown): ActifProjet[] {
  const out: ActifProjet[] = []
  const ids = new Set<string>()
  for (const raw of Array.isArray(input) ? input : []) {
    if (!raw || typeof raw !== 'object') continue
    const a = raw as Record<string, unknown>
    const nom = texte(a.nom, 200)
    if (!nom) continue
    let id = typeof a.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(a.id) ? a.id : nouvelId()
    while (ids.has(id)) id = `${id}_`
    ids.add(id)
    const description = texte(a.description, 500)
    const source = texte(a.source, 200)
    out.push({ id, nom, type: ACTIF_TYPES.includes(a.type as ActifType) ? a.type as ActifType : 'SERVICE', criticite: borne(a.criticite), ...(description ? { description } : {}), ...(source ? { source } : {}) })
    if (out.length >= ACTIFS_MAX) break
  }
  return out
}

/** Valeurs métier (EBIOS RM atelier 1) → données et services du projet. */
export function actifsDepuisValeursMetier(valeurs: unknown, evenementsRedoutes: unknown, sourceNom: string): ActifProjet[] {
  const graviteParVm = new Map<string, number>()
  for (const er of Array.isArray(evenementsRedoutes) ? evenementsRedoutes : []) {
    const e = er as { valeurMetierId?: unknown; gravite?: unknown }
    const g = Number(e?.gravite)
    if (typeof e?.valeurMetierId === 'string' && Number.isFinite(g)) graviteParVm.set(e.valeurMetierId, Math.max(graviteParVm.get(e.valeurMetierId) ?? 0, g))
  }
  return sanitizeActifsProjet((Array.isArray(valeurs) ? valeurs : []).map(raw => {
    const v = (raw ?? {}) as Record<string, unknown>
    const dict = [v.disponibilite, v.integrite, v.confidentialite, v.tracabilite].map(Number).filter(n => Number.isFinite(n) && n > 0)
    const criticite = dict.length ? Math.max(...dict) : graviteParVm.get(String(v.id)) ?? CRITICITE_DEFAUT
    return { nom: v.nom, type: v.type === 'INFORMATION' ? 'DONNEE' : 'SERVICE', criticite, description: v.description, source: sourceNom }
  }))
}

/** Ajoute les nouvelles lignes absentes (intitulé normalisé) ; les lignes existantes restent telles quelles. */
export function fusionnerActifs(existants: readonly ActifProjet[], nouveaux: readonly ActifProjet[]): { actifs: ActifProjet[]; ajoutes: number } {
  const noms = new Set(existants.map(a => normaliser(a.nom)))
  const ajout = nouveaux.filter(a => { const k = normaliser(a.nom); if (noms.has(k)) return false; noms.add(k); return true })
  const actifs = sanitizeActifsProjet([...existants, ...ajout])
  return { actifs, ajoutes: actifs.length - existants.length }
}
