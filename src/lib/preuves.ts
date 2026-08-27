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

// Types de média INERTES autorisés pour une preuve (data URL). Volontairement sans
// text/html, image/svg+xml, application/xhtml+xml ni autre format à contenu actif :
// ces formats peuvent porter du script et provoqueraient un XSS stocké si une preuve
// était un jour rendue/ouverte inline (#129, CWE-79). Aligné sur ALLOWED_DOCUMENT_MIME.
export const PREUVE_MIME_AUTORISES = new Set<string>([
  'image/png',
  'image/jpeg',
  'application/pdf',
  'text/plain',
  'text/csv',
])

/** Type de média déclaré dans une data URL (`data:<média>[;...]` ), en minuscules. */
export function dataUrlMediaType(dataUrl: string): string {
  const m = /^data:([^;,]*)/i.exec(dataUrl)
  return (m?.[1] ?? '').trim().toLowerCase()
}

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
    // Borne le type de média au jeu inerte (anti-XSS stocké, #129).
    if (!PREUVE_MIME_AUTORISES.has(dataUrlMediaType(dataUrl))) return []
    return [{
      nom: String(o.nom ?? 'preuve').slice(0, 200),
      mime: String(o.mime ?? '').slice(0, 100),
      taille: typeof o.taille === 'number' ? o.taille : dataUrl.length,
      dataUrl,
    }]
  })
}
