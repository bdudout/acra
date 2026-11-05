// ─── Stratégie cyber / IT / résilience — logique pure (lot S1a) ──────────────
// Saisies (zod), transitions de statut, figeage OPTIONNEL du cadre après validation (`strategieCadreFige`),
// justification exigée pour toute évolution après validation, instantané du cadre validé et écart avec le cadre
// courant, plan de copie « nouvelle version ». Aucune dépendance DB. Testé : strategie.test.ts.
// Spec : docs/specs/strategie-cyber-it-resilience.md.
import { z } from 'zod'
import { ACTION_SOURCES } from './action-items'

export const STRATEGIE_TYPES = ['CYBER', 'IT', 'RESILIENCE', 'INTEGREE'] as const
export type StrategieType = (typeof STRATEGIE_TYPES)[number]
export const STRATEGIE_STATUTS = ['BROUILLON', 'VALIDEE', 'ARCHIVEE'] as const
export type StrategieStatut = (typeof STRATEGIE_STATUTS)[number]
export const RATTACHEMENT_PROVENANCES = ['MANUEL', 'ASSISTANT', 'MCP'] as const
export const EVOLUTION_TYPES = [
  'AJOUT_RATTACHEMENT', 'RETRAIT_RATTACHEMENT',
  'AJOUT_AXE', 'MODIF_AXE', 'SUPPR_AXE',
  'AJOUT_OBJECTIF', 'MODIF_OBJECTIF', 'SUPPR_OBJECTIF',
  'IDENTIFIANTS',
] as const
export type EvolutionType = (typeof EVOLUTION_TYPES)[number]

export const JUSTIFICATION_MAX = 2000

/** Codes d'erreur renvoyés par /api/strategies/** (libellés : `strategie.erreurs.<code>`, 5 langues). */
export const STRATEGIE_ERREURS = [
  'cadre_fige', 'strategie_validee', 'strategie_archivee', 'justification_requise', 'transition_invalide',
  'source_introuvable', 'deja_rattache', 'module_inactif', 'not_found', 'forbidden',
  'identifiants_invalides', 'version_en_cours', 'axe_non_vide', 'kri_introuvable',
] as const

// ─── Saisies ─────────────────────────────────────────────────────────────────
const texte = (max: number) => z.string().trim().min(1).max(max)
const texteOpt = (max: number) => z.string().trim().max(max).nullish().transform(v => v || null)
const dateOpt = z.union([z.string(), z.null()]).optional().transform((v, ctx) => {
  if (v == null || v === '') return v === undefined ? undefined : null
  const d = new Date(v)
  if (isNaN(d.getTime())) { ctx.addIssue({ code: 'custom', message: 'date' }); return z.NEVER }
  return d
})
const justification = z.string().optional()
// Identifiants internes : validés et normalisés par `normaliserIdentifiants` (400 `identifiants_invalides`).
const identifiants = { referenceInterne: z.unknown().optional(), identifiantsExternes: z.unknown().optional() }

const periodeCoherente = (v: { periodeDebut?: Date | null; periodeFin?: Date | null }) =>
  !(v.periodeDebut && v.periodeFin && v.periodeFin < v.periodeDebut)

const strategieChamps = {
  titre: texte(200),
  description: texteOpt(4000),
  type: z.enum(STRATEGIE_TYPES),
  periodeDebut: dateOpt,
  periodeFin: dateOpt,
  ...identifiants,
}
export const strategieCreateSchema = z.object(strategieChamps).refine(periodeCoherente, { path: ['periodeFin'], message: 'periode' })
export const strategieUpdateSchema = z.object(strategieChamps).partial().refine(periodeCoherente, { path: ['periodeFin'], message: 'periode' })

export const axeSchema = z.object({
  titre: texte(200),
  description: texteOpt(4000),
  ordre: z.number().int().min(0).max(10000).optional(),
  referenceRef: texteOpt(200),
  justification,
  ...identifiants,
})
export const axeUpdateSchema = axeSchema.partial()

export const objectifSchema = z.object({
  titre: texte(200),
  indicateur: texteOpt(2000),
  cible: texteOpt(200),
  echeance: dateOpt,
  kriId: texteOpt(64),
  justification,
  ...identifiants,
})
export const objectifUpdateSchema = objectifSchema.partial()

export const rattachementSchema = z.object({
  axeId: texte(64),
  sourceType: z.enum(ACTION_SOURCES),
  sourceId: texte(200),
  provenance: z.enum(RATTACHEMENT_PROVENANCES).default('MANUEL'),
  justification,
})

/** Justification saisie : texte non vide, tronqué à JUSTIFICATION_MAX ; null sinon. */
export function lireJustification(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, JUSTIFICATION_MAX) : null
}

// ─── Identifiants internes (lien comptable / budgétaire) ────────────────────
export const REFERENCE_INTERNE_MAX = 100
export const IDENTIFIANTS_EXTERNES_MAX = 10
export const IDENTIFIANT_SYSTEME_MAX = 50
export const IDENTIFIANT_VALEUR_MAX = 100
export interface IdentifiantExterne { systeme: string; valeur: string }
export interface Identifiants { referenceInterne?: string | null; identifiantsExternes?: IdentifiantExterne[] | null }
export const CHAMPS_IDENTIFIANTS = ['referenceInterne', 'identifiantsExternes'] as const

/**
 * Normalise les identifiants internes d'une saisie (stratégie, axe, objectif). Seules les clés présentes sont
 * renvoyées ; '' / null / [] effacent. Rejette (`identifiants_invalides`) un type faux, une longueur excessive,
 * plus de 10 identifiants externes, un `systeme` ou une `valeur` vide, un `systeme` en double (casse ignorée).
 */
export function normaliserIdentifiants(input: unknown): { ok: true; value: Identifiants } | { ok: false; error: 'identifiants_invalides' } {
  const ko = { ok: false, error: 'identifiants_invalides' } as const
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const value: Identifiants = {}
  if ('referenceInterne' in src && src.referenceInterne !== undefined) {
    const v = src.referenceInterne
    if (v !== null && typeof v !== 'string') return ko
    const t = (v ?? '').trim()
    if (t.length > REFERENCE_INTERNE_MAX) return ko
    value.referenceInterne = t || null
  }
  if ('identifiantsExternes' in src && src.identifiantsExternes !== undefined) {
    const v = src.identifiantsExternes
    if (v === null) value.identifiantsExternes = null
    else {
      if (!Array.isArray(v) || v.length > IDENTIFIANTS_EXTERNES_MAX) return ko
      const vus = new Set<string>()
      const liste: IdentifiantExterne[] = []
      for (const e of v) {
        if (!e || typeof e !== 'object') return ko
        const { systeme, valeur } = e as Record<string, unknown>
        if (typeof systeme !== 'string' || typeof valeur !== 'string') return ko
        const sy = systeme.trim(), va = valeur.trim()
        if (!sy || !va || sy.length > IDENTIFIANT_SYSTEME_MAX || va.length > IDENTIFIANT_VALEUR_MAX) return ko
        const cle = sy.toLowerCase()
        if (vus.has(cle)) return ko
        vus.add(cle)
        liste.push({ systeme: sy, valeur: va })
      }
      value.identifiantsExternes = liste.length ? liste : null
    }
  }
  return { ok: true, value }
}

/**
 * Sépare une saisie validée (zod) en identifiants normalisés, justification (retirée) et champs du cadre (`reste`).
 */
export function extraireIdentifiants<T extends Record<string, unknown>>(body: T):
  { ok: true; ids: Identifiants; reste: Omit<T, 'referenceInterne' | 'identifiantsExternes' | 'justification'> } | { ok: false; error: 'identifiants_invalides' } {
  const n = normaliserIdentifiants(body)
  if (!n.ok) return n
  const { referenceInterne: _r, identifiantsExternes: _i, justification: _j, ...reste } = body
  const propre = Object.fromEntries(Object.entries(reste).filter(([, v]) => v !== undefined))
  return { ok: true, ids: n.value, reste: propre as Omit<T, 'referenceInterne' | 'identifiantsExternes' | 'justification'> }
}

/** Avant / après des seuls identifiants fournis ; null s'ils sont absents ou inchangés (rien à historiser). */
export function changementIdentifiants(row: IdsSource, ids: Identifiants): { avant: Identifiants; apres: Identifiants } | null {
  const avant: Identifiants = {}
  const apres: Identifiants = {}
  if (ids.referenceInterne !== undefined && (row.referenceInterne ?? null) !== ids.referenceInterne) {
    avant.referenceInterne = row.referenceInterne ?? null
    apres.referenceInterne = ids.referenceInterne
  }
  if (ids.identifiantsExternes !== undefined) {
    const prec = lireIdentifiantsExternes(row.identifiantsExternes)
    if (JSON.stringify(prec) !== JSON.stringify(ids.identifiantsExternes)) {
      avant.identifiantsExternes = prec
      apres.identifiantsExternes = ids.identifiantsExternes
    }
  }
  return Object.keys(apres).length ? { avant, apres } : null
}

/** Relit des identifiants externes stockés (JSON) ; null si absents. */
export function lireIdentifiantsExternes(v: unknown): IdentifiantExterne[] | null {
  return Array.isArray(v) && v.length ? (v as IdentifiantExterne[]) : null
}

// ─── Règles de statut ────────────────────────────────────────────────────────
const TRANSITIONS: Record<string, readonly string[]> = { BROUILLON: ['VALIDEE'], VALIDEE: ['ARCHIVEE'], ARCHIVEE: [] }

/** Cycle de vie : BROUILLON → VALIDEE → ARCHIVEE (une validée est aussi archivée à la validation de sa version suivante). */
export function transitionAutorisee(de: string, vers: string): boolean {
  return (TRANSITIONS[de] ?? []).includes(vers)
}

export type Decision = { ok: true; historiser: boolean } | { ok: false; status: 400 | 409; error: string }

/**
 * Modification du cadre (axes, objectifs) : libre en BROUILLON ; après validation, refusée si le cadre est figé
 * (option d'organisation, défaut), sinon autorisée avec justification obligatoire et historisée.
 */
export function decisionModifCadre(statut: string, cadreFige: boolean, justif: string | null): Decision {
  if (statut === 'BROUILLON') return { ok: true, historiser: false }
  if (statut !== 'VALIDEE') return { ok: false, status: 409, error: 'strategie_archivee' }
  if (cadreFige) return { ok: false, status: 409, error: 'cadre_fige' }
  if (!justif) return { ok: false, status: 400, error: 'justification_requise' }
  return { ok: true, historiser: true }
}

/**
 * Suppression d'un axe : règles du cadre ; après validation (cadre non figé), un axe NON VIDE (objectifs ou
 * rattachements) est refusé (409 `axe_non_vide`) — l'historique tracerait sinon une suppression incomplète.
 */
export function decisionSuppressionAxe(statut: string, cadreFige: boolean, justif: string | null, nonVide: boolean): Decision {
  const d = decisionModifCadre(statut, cadreFige, justif)
  if (d.ok && d.historiser && nonVide) return { ok: false, status: 409, error: 'axe_non_vide' }
  return d
}

/** Rattachement / retrait d'un élément : quel que soit le figeage, sauf ARCHIVEE ; justifié et historisé après validation. */
export function decisionRattachement(statut: string, justif: string | null): Decision {
  if (statut === 'BROUILLON') return { ok: true, historiser: false }
  if (statut !== 'VALIDEE') return { ok: false, status: 409, error: 'strategie_archivee' }
  if (!justif) return { ok: false, status: 400, error: 'justification_requise' }
  return { ok: true, historiser: true }
}

/**
 * Identifiants internes (métadonnée administrative) : modifiables même si le cadre est figé ; après validation, chaque
 * modification est historisée (type IDENTIFIANTS, avant / après) sans justification obligatoire. ARCHIVEE : 409.
 */
export function decisionModifIdentifiants(statut: string): Decision {
  if (statut === 'BROUILLON') return { ok: true, historiser: false }
  if (statut !== 'VALIDEE') return { ok: false, status: 409, error: 'strategie_archivee' }
  return { ok: true, historiser: true }
}

/** Champs de la stratégie (titre, type, période…) : modifiables en BROUILLON ; ensuite, nouvelle version. */
export function decisionModifStrategie(statut: string): { ok: true } | { ok: false; status: 409; error: string } {
  if (statut === 'BROUILLON') return { ok: true }
  return { ok: false, status: 409, error: statut === 'VALIDEE' ? 'strategie_validee' : 'strategie_archivee' }
}

// ─── Instantané et écart du cadre ────────────────────────────────────────────
type DateLike = Date | string | null | undefined
interface IdsCadre { referenceInterne: string | null; identifiantsExternes: IdentifiantExterne[] | null }
export interface ObjectifCadre extends IdsCadre { id: string; titre: string; indicateur: string | null; cible: string | null; echeance: string | null; kriId: string | null }
export interface AxeCadre extends IdsCadre { id: string; ordre: number; titre: string; description: string | null; referenceRef: string | null; objectifs: ObjectifCadre[] }
export interface CadreInstantane { axes: AxeCadre[]; strategie?: IdsCadre }

interface IdsSource { referenceInterne?: string | null; identifiantsExternes?: unknown }
interface ObjectifSource extends IdsSource { id: string; titre: string; indicateur?: string | null; cible?: string | null; echeance?: DateLike; kriId?: string | null }
interface AxeSource extends IdsSource { id: string; ordre?: number; titre: string; description?: string | null; referenceRef?: string | null; objectifs?: ObjectifSource[] }

const ids = (x: IdsSource): IdsCadre => ({ referenceInterne: x.referenceInterne ?? null, identifiantsExternes: lireIdentifiantsExternes(x.identifiantsExternes) })
const iso = (d: DateLike): string | null => (d == null || d === '' ? null : new Date(d).toISOString())

function normObjectif(o: ObjectifSource): ObjectifCadre {
  return { id: o.id, titre: o.titre, indicateur: o.indicateur ?? null, cible: o.cible ?? null, echeance: iso(o.echeance), kriId: o.kriId ?? null, ...ids(o) }
}
function normAxe(a: AxeSource): AxeCadre {
  return { id: a.id, ordre: a.ordre ?? 0, titre: a.titre, description: a.description ?? null, referenceRef: a.referenceRef ?? null, objectifs: (a.objectifs ?? []).map(normObjectif), ...ids(a) }
}

/** Instantané immuable du cadre (axes + objectifs), stocké à la validation (`Strategie.cadreValide`). */
export function instantaneCadre(axes: AxeSource[], strategie?: IdsSource): CadreInstantane {
  return strategie ? { axes: axes.map(normAxe), strategie: ids(strategie) } : { axes: axes.map(normAxe) }
}

/** Relit un instantané stocké (JSON) ; null si absent ou invalide. */
export function lireInstantane(v: unknown): CadreInstantane | null {
  if (!v || typeof v !== 'object' || !Array.isArray((v as { axes?: unknown }).axes)) return null
  return v as CadreInstantane
}

export interface EcartCadre {
  identique: boolean
  axes: { ajoutes: AxeCadre[]; modifies: { id: string; avant: AxeCadre; apres: AxeCadre }[]; supprimes: AxeCadre[] }
  objectifs: { ajoutes: (ObjectifCadre & { axeId: string })[]; modifies: { id: string; axeId: string; avant: ObjectifCadre; apres: ObjectifCadre }[]; supprimes: (ObjectifCadre & { axeId: string })[] }
}

const champsAxe = (a: AxeCadre) => JSON.stringify([a.ordre, a.titre, a.description, a.referenceRef])
const champsObj = (o: ObjectifCadre) => JSON.stringify([o.titre, o.indicateur, o.cible, o.echeance, o.kriId])

/** Écart entre le cadre validé (instantané) et le cadre courant. Sans instantané : écart vide. Les identifiants internes
 * (métadonnée administrative, historisée à part) n'entrent pas dans l'écart. */
export function ecartCadre(valide: CadreInstantane | null, courantSrc: AxeSource[]): EcartCadre {
  const e: EcartCadre = { identique: true, axes: { ajoutes: [], modifies: [], supprimes: [] }, objectifs: { ajoutes: [], modifies: [], supprimes: [] } }
  if (!valide) return e
  const courant = courantSrc.map(normAxe)
  const avantAxes = new Map(valide.axes.map(a => [a.id, a]))
  const apresAxes = new Map(courant.map(a => [a.id, a]))
  const avantObj = new Map(valide.axes.flatMap(a => a.objectifs.map(o => [o.id, { ...o, axeId: a.id }] as const)))
  const apresObj = new Map(courant.flatMap(a => a.objectifs.map(o => [o.id, { ...o, axeId: a.id }] as const)))

  for (const a of courant) {
    const av = avantAxes.get(a.id)
    if (!av) e.axes.ajoutes.push(a)
    else if (champsAxe(av) !== champsAxe(a)) e.axes.modifies.push({ id: a.id, avant: av, apres: a })
  }
  for (const a of valide.axes) if (!apresAxes.has(a.id)) e.axes.supprimes.push(a)
  for (const [id, o] of apresObj) {
    const av = avantObj.get(id)
    if (!av) e.objectifs.ajoutes.push(o)
    else if (champsObj(av) !== champsObj(o) || av.axeId !== o.axeId) {
      const { axeId: _a, ...avant } = av
      const { axeId, ...apres } = o
      e.objectifs.modifies.push({ id, axeId, avant, apres })
    }
  }
  for (const [id, o] of avantObj) if (!apresObj.has(id)) e.objectifs.supprimes.push(o)
  e.identique = !e.axes.ajoutes.length && !e.axes.modifies.length && !e.axes.supprimes.length
    && !e.objectifs.ajoutes.length && !e.objectifs.modifies.length && !e.objectifs.supprimes.length
  return e
}

/** Rattachements ajoutés après la validation (aucun si la stratégie n'a jamais été validée). */
export function rattachementsDepuisValidation<T extends { createdAt: Date | string }>(rattachements: T[], valideeLe: DateLike): T[] {
  if (!valideeLe) return []
  const v = new Date(valideeLe).getTime()
  return rattachements.filter(r => new Date(r.createdAt).getTime() > v)
}

// ─── Nouvelle version ────────────────────────────────────────────────────────
interface StrategieSource extends IdsSource {
  id: string; organizationId: string; titre: string; description: string | null; type: string
  periodeDebut: Date | null; periodeFin: Date | null; statut: string; version: number
  axes: (AxeSource & { rattachements?: { sourceType: string; sourceId: string; provenance: string; ajoutePar: string | null }[] })[]
}

export interface PlanNouvelleVersion {
  strategie: IdsCadre & { organizationId: string; titre: string; description: string | null; type: string; periodeDebut: Date | null; periodeFin: Date | null; statut: 'BROUILLON'; version: number; versionPrecedenteId: string; createdById: string }
  axes: (IdsCadre & { ordre: number; titre: string; description: string | null; referenceRef: string | null; objectifs: (IdsCadre & { titre: string; indicateur: string | null; cible: string | null; echeance: Date | null; kriId: string | null })[]; rattachements: { sourceType: string; sourceId: string; provenance: string; ajoutePar: string | null }[] })[]
}

/** Copie d'une stratégie VALIDEE en BROUILLON (version + 1) ; l'ancienne reste VALIDEE jusqu'à la validation de la copie. null si non VALIDEE. */
export function planNouvelleVersion(s: StrategieSource, userId: string): PlanNouvelleVersion | null {
  if (s.statut !== 'VALIDEE') return null
  return {
    strategie: {
      organizationId: s.organizationId, titre: s.titre, description: s.description, type: s.type,
      periodeDebut: s.periodeDebut, periodeFin: s.periodeFin, statut: 'BROUILLON', version: s.version + 1,
      versionPrecedenteId: s.id, createdById: userId, ...ids(s),
    },
    axes: s.axes.map(a => ({
      ordre: a.ordre ?? 0, titre: a.titre, description: a.description ?? null, referenceRef: a.referenceRef ?? null, ...ids(a),
      objectifs: (a.objectifs ?? []).map(o => ({ titre: o.titre, indicateur: o.indicateur ?? null, cible: o.cible ?? null, echeance: o.echeance ? new Date(o.echeance) : null, kriId: o.kriId ?? null, ...ids(o) })),
      rattachements: (a.rattachements ?? []).map(r => ({ sourceType: r.sourceType, sourceId: r.sourceId, provenance: r.provenance, ajoutePar: r.ajoutePar })),
    })),
  }
}

// ─── Report des rattachements à la validation d'une nouvelle version (lot S1b) ──
interface RattachementReportable { sourceType: string; sourceId: string; provenance: string; ajoutePar: string | null; createdAt: Date | string }
interface CopieRattachement { id?: string; sourceType: string; sourceId: string; createdAt?: Date | string }
/** Retrait fait sur la version N (évolution RETRAIT_RATTACHEMENT) ; `axeTitre` résolu par l'appelant (null : axe inconnu). */
export interface RetraitReportable { axeTitre: string | null; sourceType: string; sourceId: string; justification: string; createdAt: Date | string }
type Signalement = { axeTitre: string; sourceType: string; sourceId: string }
export interface PlanReport {
  aCreer: { axeId: string; sourceType: string; sourceId: string; provenance: string; ajoutePar: string | null }[]
  nonReportes: Signalement[]
  aSupprimer: { id: string; axeId: string; sourceType: string; sourceId: string; justification: string }[]
  retraitsNonReportes: Signalement[]
}

const cleTitre = (t: string) => t.trim().toLocaleLowerCase()
const cleSource = (r: { sourceType: string; sourceId: string }) => `${r.sourceType}:${r.sourceId}`

/**
 * Évolutions de la version N APRÈS l'ouverture du brouillon N+1 (`ouvertureLe`), reportées sur l'axe de la N+1 de même
 * titre (espaces et casse ignorés) :
 *  - ajouts : recopiés ; axe absent → `nonReportes` ; doublon (déjà sur l'axe cible, ou axes homonymes de N) → ignoré ;
 *  - retraits : la copie faite à l'ouverture est retirée ; copie rajoutée depuis dans la N+1 (choix délibéré) ou axe
 *    absent → `retraitsNonReportes` ; source rattachée de nouveau dans N ou déjà absente de la N+1 → rien à faire.
 */
export function planReportRattachements(
  precedents: { id: string; titre: string; rattachements: RattachementReportable[] }[],
  suivants: { id: string; titre: string; rattachements: CopieRattachement[] }[],
  ouvertureLe: DateLike,
  retraits: RetraitReportable[] = [],
): PlanReport {
  const plan: PlanReport = { aCreer: [], nonReportes: [], aSupprimer: [], retraitsNonReportes: [] }
  if (!ouvertureLe) return plan
  const seuil = new Date(ouvertureLe).getTime()
  const apres = (d: Date | string | undefined) => d != null && new Date(d).getTime() > seuil
  const cible = new Map<string, { id: string; deja: Set<string>; copies: CopieRattachement[] }>()
  for (const a of suivants) {
    const k = cleTitre(a.titre)
    if (!cible.has(k)) cible.set(k, { id: a.id, deja: new Set(a.rattachements.map(cleSource)), copies: a.rattachements })
  }
  for (const a of precedents) {
    for (const r of a.rattachements) {
      if (!apres(r.createdAt)) continue
      const c = cible.get(cleTitre(a.titre))
      if (!c) { plan.nonReportes.push({ axeTitre: a.titre, sourceType: r.sourceType, sourceId: r.sourceId }); continue }
      const k = cleSource(r)
      if (c.deja.has(k)) continue
      c.deja.add(k)
      plan.aCreer.push({ axeId: c.id, sourceType: r.sourceType, sourceId: r.sourceId, provenance: r.provenance, ajoutePar: r.ajoutePar })
    }
  }
  // Présent aujourd'hui dans N (rattaché de nouveau après le retrait) : le retrait n'a plus d'effet.
  const presentsN = new Set(precedents.flatMap(a => a.rattachements.map(r => `${cleTitre(a.titre)}|${cleSource(r)}`)))
  const traites = new Set<string>()
  for (const rt of [...retraits].sort((x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime())) {
    if (!apres(rt.createdAt)) continue
    const titre = rt.axeTitre ?? ''
    const k = `${cleTitre(titre)}|${cleSource(rt)}`
    if (presentsN.has(k) || traites.has(k)) continue
    traites.add(k)
    const signal = { axeTitre: rt.axeTitre ?? '—', sourceType: rt.sourceType, sourceId: rt.sourceId }
    const c = rt.axeTitre ? cible.get(cleTitre(rt.axeTitre)) : undefined
    if (!c) { plan.retraitsNonReportes.push(signal); continue }
    const copie = c.copies.find(x => cleSource(x) === cleSource(rt))
    if (!copie) continue
    if (apres(copie.createdAt) || !copie.id) { plan.retraitsNonReportes.push(signal); continue }
    plan.aSupprimer.push({ id: copie.id, axeId: c.id, sourceType: rt.sourceType, sourceId: rt.sourceId, justification: rt.justification })
  }
  return plan
}
