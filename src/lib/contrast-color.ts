/**
 * Choix automatique d'une couleur de texte lisible sur un fond coloré donné.
 *
 * Les échelles ACRA (gravité, vraisemblance, matrice) utilisent des couleurs
 * configurables, parfois claires (vert, ambre, lime). Y forcer `text-white`
 * produit un contraste très faible (ex. blanc sur jaune ≈ 1.9:1). On choisit
 * ici, selon la luminance relative WCAG du fond, entre un texte sombre et un
 * texte clair — celui qui offre le meilleur contraste.
 */

export const DARK_TEXT = '#111827'  // gray-900
export const LIGHT_TEXT = '#ffffff' // white

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const f = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/**
 * Retourne `DARK_TEXT` ou `LIGHT_TEXT`, celui qui contraste le mieux avec `hexBg`.
 * Valeur invalide → `LIGHT_TEXT` (comportement historique `text-white`).
 */
export function readableTextColor(hexBg: string): typeof DARK_TEXT | typeof LIGHT_TEXT {
  const rgb = hexToRgb(hexBg)
  if (!rgb) return LIGHT_TEXT
  const L = relativeLuminance(rgb)
  const contrastWithLight = 1.05 / (L + 0.05)            // blanc : (1.0 + 0.05) / (L + 0.05)
  const contrastWithDark = (L + 0.05) / (0.0066 + 0.05)  // gray-900 (L ≈ 0.0066)
  return contrastWithDark >= contrastWithLight ? DARK_TEXT : LIGHT_TEXT
}
