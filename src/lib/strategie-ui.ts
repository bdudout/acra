// ─── Stratégie cyber / IT / résilience — aides d'affichage (lot S1b) ──────────
// Droits affichés selon le rôle effectif (les routes /api/strategies/** restent seules juges), mode d'édition du cadre
// selon le statut et le figeage, message d'erreur i18n, rendu lisible de l'avant / après d'une évolution. Pur, sans DB.
// Testé : strategie-ui.test.ts.
import { peutRattacherStrategie, peutRedigerStrategie, peutValiderStrategie, peutVoirStrategie, type UserRole } from './permissions'

export interface DroitsStrategie { voir: boolean; rediger: boolean; valider: boolean; rattacher: boolean }

/** Boutons à afficher pour un rôle (AUDITEUR : lecture seule ; LECTEUR : aucun accès). */
export function droitsStrategie(role: UserRole): DroitsStrategie {
  const voir = peutVoirStrategie(role)
  return {
    voir,
    rediger: voir && peutRedigerStrategie(role),
    valider: voir && peutValiderStrategie(role),
    rattacher: voir && peutRattacherStrategie(role),
  }
}

/** Édition du cadre (axes, objectifs) : libre en brouillon ; après validation figée ou justifiée ; archivée : lecture. */
export type ModeEditionCadre = 'libre' | 'justifiee' | 'fige' | 'lecture'
export function modeEditionCadre(statut: string, cadreFige: boolean): ModeEditionCadre {
  if (statut === 'BROUILLON') return 'libre'
  if (statut === 'VALIDEE') return cadreFige ? 'fige' : 'justifiee'
  return 'lecture'
}

/** Libellé d'un code d'erreur de l'API (`strategie.erreurs.<code>`), sinon le message par défaut. */
export function messageErreurStrategie(code: string | undefined | null, erreurs: Record<string, string>, defaut: string): string {
  return (code && erreurs[code]) || defaut
}

export interface ContexteResume {
  champs: Record<string, string>
  sources: Record<string, string>
  provenances: Record<string, string>
  /** Titre des axes connus, par id. */
  axes: Map<string, string>
  /** Titre des éléments rattachables connus, par `${sourceType}:${sourceId}`. */
  elements: Map<string, string>
  locale: string
  /** Gabarit « libellé / valeur » de la langue (`strategie.ui.gabaritChamp`, ex. « {label} : {value} »). */
  gabarit: string
}

/** « Libellé : valeur » selon le gabarit de la langue (espace avant les deux-points en français seulement). */
export function libelleValeur(gabarit: string, label: string, value: string): string {
  return gabarit.replace('{label}', label).replace('{value}', value)
}

const DATE_ISO = /^\d{4}-\d{2}-\d{2}T/

function valeurLisible(cle: string, v: unknown, o: Record<string, unknown>, ctx: ContexteResume): string {
  if (v == null || v === '') return '—'
  if (cle === 'axeId' && typeof v === 'string') return ctx.axes.get(v) ?? v
  if (cle === 'sourceType' && typeof v === 'string') return ctx.sources[v] ?? v
  if (cle === 'provenance' && typeof v === 'string') return ctx.provenances[v] ?? v
  if (cle === 'sourceId' && typeof v === 'string') return ctx.elements.get(`${String(o.sourceType)}:${v}`) ?? v
  if (Array.isArray(v)) {
    return v.map(e => (e && typeof e === 'object' && 'systeme' in e ? `${String((e as { systeme: unknown }).systeme)} ${String((e as { valeur?: unknown }).valeur ?? '')}` : String(e))).join(', ') || '—'
  }
  if (typeof v === 'string' && DATE_ISO.test(v)) {
    const d = new Date(v)
    if (!isNaN(d.getTime())) return d.toLocaleDateString(ctx.locale, { timeZone: 'UTC' })
  }
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** Avant / après d'une évolution, lisible : « Champ : valeur · Champ : valeur » ; rien → « — ». */
export function resumeValeurs(v: unknown, ctx: ContexteResume): string {
  if (!v || typeof v !== 'object') return '—'
  const o = v as Record<string, unknown>
  const parts = Object.entries(o)
    .filter(([, val]) => val !== undefined)
    .map(([k, val]) => libelleValeur(ctx.gabarit, ctx.champs[k] ?? k, valeurLisible(k, val, o, ctx)))
  return parts.length ? parts.join(' · ') : '—'
}
