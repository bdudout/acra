/**
 * spreadsheet-safe.ts — Neutralisation de l'injection de formules (CWE-1236).
 *
 * Lorsqu'un export CSV/XLSX contient une cellule dont la valeur commence par
 * = + - @ (ou une tabulation / retour chariot), un tableur (Excel, LibreOffice,
 * Google Sheets) peut l'interpréter comme une formule et exécuter du code à
 * l'ouverture du fichier. On préfixe ces valeurs par une apostrophe pour forcer
 * le tableur à les traiter comme du texte.
 *
 * Les valeurs numériques (type `number`) restent intactes : elles ne portent
 * pas de risque d'injection et doivent rester exploitables comme nombres.
 */

// Caractères déclencheurs de formule en tête de cellule
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r', '\n']

export function sanitizeForSpreadsheet(value: unknown): string {
  if (value === null || value === undefined) return ''
  // Les nombres sont sûrs : on ne les altère pas (pas d'apostrophe parasite)
  if (typeof value === 'number') return String(value)

  const str = String(value)
  if (str.length > 0 && FORMULA_TRIGGERS.includes(str[0])) {
    return `'${str}`
  }
  return str
}

/**
 * Produit une cellule CSV sûre :
 *  1. neutralise l'injection de formule (sanitizeForSpreadsheet),
 *  2. applique l'échappement CSV RFC 4180 (guillemets + doublage des guillemets
 *     internes) uniquement si la valeur contient une virgule, un guillemet ou
 *     un saut de ligne.
 *
 * À utiliser pour TOUTE écriture de cellule dans un export CSV (journal d'audit,
 * analyses, …) afin d'éviter les divergences de durcissement entre exports.
 */
export function toCsvCell(value: unknown): string {
  const sanitized = sanitizeForSpreadsheet(value)
  if (/[",\r\n]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`
  }
  return sanitized
}
