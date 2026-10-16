// ─── Enregistrement d'un atelier : verrou optimiste (T9) et brouillon local (intégrité) ──────
// Le client envoie la révision qu'il a chargée (`If-Match`) et retient celle renvoyée ; si un autre
// éditeur a enregistré entre-temps, le serveur répond 409 et rien n'est écrasé (cf. lib/atelier-revision).
// Décision du 16/10/2026 (intégrité) : une saisie qui n'a pas pu être enregistrée n'est JAMAIS perdue —
// elle est gardée dans le navigateur avec la révision sur laquelle elle s'appuie, puis renvoyée
// (automatiquement par useAutoSave tant que la page est ouverte, ou depuis le bandeau après rechargement).

export interface BrouillonAtelier { data: unknown; revision: number; date: string }
/** Erreur d'enregistrement : `reessayable` = une nouvelle tentative peut réussir (réseau, serveur). */
export type ErreurEnregistrement = Error & { reessayable: boolean }

const cle = (analyseId: string, num: number) => `acra:brouillon-atelier:${analyseId}:${num}`
const erreur = (message: string, reessayable: boolean): ErreurEnregistrement => Object.assign(new Error(message), { reessayable })

/** Brouillon non enregistré de l'atelier, ou null (stockage indisponible → null, jamais d'exception). */
export function lireBrouillon(analyseId: string, num: number): BrouillonAtelier | null {
  try {
    const v = localStorage.getItem(cle(analyseId, num))
    const b = v ? JSON.parse(v) as BrouillonAtelier : null
    return b && typeof b.revision === 'number' && typeof b.date === 'string' ? b : null
  } catch { return null }
}
function ecrireBrouillon(analyseId: string, num: number, data: unknown, revision: number): void {
  try { localStorage.setItem(cle(analyseId, num), JSON.stringify({ data, revision, date: new Date().toISOString() })) } catch { /* stockage plein ou interdit */ }
}
export function effacerBrouillon(analyseId: string, num: number): void {
  try { localStorage.removeItem(cle(analyseId, num)) } catch { /* stockage interdit */ }
}

async function envoyer(analyseId: string, num: number, data: unknown, revision: number): Promise<'ok' | 'conflit' | 'echec' | number> {
  try {
    const res = await fetch(`/api/analyses/${analyseId}/workshop/${num}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': String(revision) },
      body: JSON.stringify(data),
    })
    if (res.status === 409) return 'conflit'
    if (!res.ok) return 'echec'
    const d = await res.json().catch(() => null) as { revision?: unknown } | null
    return typeof d?.revision === 'number' ? d.revision : 'ok'
  } catch { return 'echec' }
}

/** Envoie l'atelier `num` ; met à jour `revision.current` ; en cas d'échec garde un brouillon et lève une erreur affichable. */
export async function enregistrerAtelier(
  analyseId: string,
  num: number,
  data: unknown,
  revision: { current: number },
  messages: { conflit: string; echec: string },
): Promise<void> {
  const base = revision.current
  const r = await envoyer(analyseId, num, data, base)
  if (r === 'conflit') { ecrireBrouillon(analyseId, num, data, base); throw erreur(messages.conflit, false) }
  if (r === 'echec') { ecrireBrouillon(analyseId, num, data, base); throw erreur(messages.echec, true) }
  if (typeof r === 'number') revision.current = r
  effacerBrouillon(analyseId, num)
}

/** Renvoie le brouillon gardé (après rechargement), avec SA révision d'origine : un conflit est signalé, jamais écrasé. */
export async function renvoyerBrouillon(analyseId: string, num: number, _messages?: unknown): Promise<'ok' | 'conflit' | 'echec' | 'absent'> {
  const b = lireBrouillon(analyseId, num)
  if (!b) return 'absent'
  const r = await envoyer(analyseId, num, b.data, b.revision)
  if (r === 'conflit' || r === 'echec') return r
  effacerBrouillon(analyseId, num)
  return 'ok'
}
