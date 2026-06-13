/**
 * format.ts — Formatage localisé des dates et nombres (UX audit #3).
 *
 * Corrige le bug d'affichage des dates au format de la locale système du
 * runtime (ex. format japonais « 6月9日 »). On force un format BCP 47 explicite
 * dérivé de la langue d'interface, avec repli sur le français (fr-FR), langue
 * principale de l'application (EBIOS RM / ANSSI).
 *
 * Pur et sans dépendance serveur — utilisable côté client comme serveur.
 */

export type AppLocale = 'fr' | 'en' | 'de' | 'es' | 'it'

const BCP47: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  de: 'de-DE',
  es: 'es-ES',
  it: 'it-IT',
}

function toBcp47(locale?: string): string {
  return (locale && BCP47[locale]) || 'fr-FR'
}

/** Date courte localisée (ex. 09/06/2026 en fr-FR). */
export function formatDate(date: Date | string | number, locale?: string): string {
  return new Date(date).toLocaleDateString(toBcp47(locale))
}

/** Date + heure localisée. */
export function formatDateTime(date: Date | string | number, locale?: string): string {
  return new Date(date).toLocaleString(toBcp47(locale))
}

/** Nombre localisé (séparateurs de milliers). */
export function formatNumber(value: number, locale?: string): string {
  return value.toLocaleString(toBcp47(locale))
}
