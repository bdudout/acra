// ─── Pièces justificatives (data URL en base) ────────────────────────────────
// Primitive PARTAGÉE par les modules qui attachent des preuves : clôture de
// dérogation, exécution de contrôle… Stockées en data URL comme les logos.
//
// Le cap est volontairement strict : ces données vivent en base et sont relues
// en clair par l'UI. 5 pièces max, ~1,4 Mo de data URL chacune (≈ 1 Mo binaire
// après encodage base64). Toute entrée non conforme est SILENCIEUSEMENT écartée
// plutôt que rejetée : une preuve douteuse ne doit pas bloquer un enregistrement
// métier (l'appelant vérifie la longueur du tableau s'il exige une preuve).

export const PREUVES_MAX = 5
export const PREUVE_DATAURL_MAX = 1_400_000

export interface Preuve {
  nom: string
  mime: string
  taille: number
  dataUrl: string
}

/** Normalise et borne une liste de preuves fournie par le client. */
export function sanitizePreuves(v: unknown): Preuve[] {
  if (!Array.isArray(v)) return []
  return v.slice(0, PREUVES_MAX).flatMap(p => {
    if (!p || typeof p !== 'object') return []
    const o = p as Record<string, unknown>
    const dataUrl = typeof o.dataUrl === 'string' ? o.dataUrl : ''
    if (!/^data:/.test(dataUrl) || dataUrl.length > PREUVE_DATAURL_MAX) return []
    return [{
      nom: String(o.nom ?? 'preuve').slice(0, 200),
      mime: String(o.mime ?? '').slice(0, 100),
      taille: typeof o.taille === 'number' ? o.taille : dataUrl.length,
      dataUrl,
    }]
  })
}
