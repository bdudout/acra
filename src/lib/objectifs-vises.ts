// ─── Objectifs visés (atelier 2) — création et pré-remplissage (PUR) ──────────
// Un OV ajouté depuis un exemple reprend sa description courte ; saisir à la main le nom d'un OV connu pré-remplit
// la description si elle est vide (jamais d'écrasement d'une saisie). Testé : objectifs-vises.test.ts.

export interface ObjectifVise { id: string; nom: string; description: string; priorite: string; pertinenceOV: number; [k: string]: unknown }
type ExempleOv = { nom?: unknown; description?: unknown; desc?: unknown }

const norm = (s: unknown) => String(s ?? '').trim().toLocaleLowerCase()
const descOf = (e: ExempleOv | undefined) => String(e?.description ?? e?.desc ?? '')

export function nouvelObjectifVise(id: string, exemple?: ExempleOv): ObjectifVise {
  return { id, nom: String(exemple?.nom ?? ''), description: descOf(exemple), priorite: 'P2', pertinenceOV: 3 }
}

export function majObjectifVise(ov: ObjectifVise, field: string, value: unknown, exemples: readonly ExempleOv[]): ObjectifVise {
  const next = { ...ov, [field]: value } as ObjectifVise
  if (field === 'nom' && !String(ov.description ?? '').trim()) {
    const connu = exemples.find(e => norm(e.nom) === norm(value) && norm(value) !== '')
    if (connu) next.description = descOf(connu)
  }
  return next
}
