// ─── Enregistrement d'un atelier avec verrou optimiste (T9) ───────────────────
// Le client envoie la révision qu'il a chargée (`If-Match`) et retient celle renvoyée ; si un autre
// éditeur a enregistré entre-temps, le serveur répond 409 et rien n'est écrasé (cf. lib/atelier-revision).

/** Envoie l'atelier `num` ; met à jour `revision.current` ; lève une erreur au message affichable. */
export async function enregistrerAtelier(
  analyseId: string,
  num: number,
  data: unknown,
  revision: { current: number },
  messages: { conflit: string; echec: string },
): Promise<void> {
  const res = await fetch(`/api/analyses/${analyseId}/workshop/${num}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': String(revision.current) },
    body: JSON.stringify(data),
  })
  if (res.status === 409) throw new Error(messages.conflit)
  if (!res.ok) throw new Error(messages.echec)
  const d = await res.json().catch(() => null) as { revision?: unknown } | null
  if (typeof d?.revision === 'number') revision.current = d.revision
}
