/**
 * org-logo.ts — Logo d'organisation généré automatiquement (multi-organisation).
 *
 * Par défaut, chaque organisation reçoit un logo « au hasard » mais DÉTERMINISTE
 * (dérivé de son identifiant) : un dégradé de couleurs agréables + le monogramme
 * (initiales). Module pur → testé, utilisable côté serveur et client.
 */

/** Hash entier stable d'une chaîne (FNV-1a 32 bits). */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Monogramme : 2 lettres (initiales des 2 premiers mots, sinon 2 premières lettres). */
export function orgInitials(nom: string): string {
  const words = (nom || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/** Deux couleurs HSL harmonieuses (analogues) dérivées de la graine. */
export function orgLogoColors(seed: string): { from: string; to: string } {
  const h = hashSeed(seed)
  const hue1 = h % 360
  const hue2 = (hue1 + 25 + ((h >> 8) % 70)) % 360 // teinte voisine → dégradé doux
  return {
    from: `hsl(${hue1} 68% 56%)`,
    to: `hsl(${hue2} 72% 44%)`,
  }
}
