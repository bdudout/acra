// ─── Cache des modules GRC pour la navigation ────────────────────────────────
// Chaque page inclut son propre <Navbar/> : le composant se re-monte à CHAQUE
// navigation. Sans cache, l'état `modules` repart à `false` (mode cyber, EBIOS
// inline) puis rebascule en mode GRC (entrées groupées) une fois le fetch
// /api/modules résolu → les entrées de la barre se « réorganisent » visiblement
// à chaque clic. On mémorise le dernier état connu pour re-rendre d'emblée la
// bonne mise en page.
//
// ⚠️ SSR : le cache mémoire est volontairement IGNORÉ côté serveur (et par le
// tout premier rendu client) via `peek` — sinon deux requêtes utilisateurs
// partageraient l'état du processus, et le 1er rendu client divergerait du HTML
// SSR (hydration mismatch). Le cache n'accélère donc que les RE-montages client
// (navigations SPA) et, via localStorage, les rechargements complets (effect).

import type { NavModules } from './navigation'

export const NAV_MODULES_STORAGE_KEY = 'acra:navModules'

const MODULE_KEYS = ['registre', 'incidents', 'controles', 'audit', 'kri', 'reglementaire'] as const

/** Valide/normalise un objet en NavModules (ou null si non reconnaissable). */
export function parseNavModules(raw: unknown): NavModules | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  // Au moins une clé connue doit être un booléen, sinon ce n'est pas notre payload.
  if (!MODULE_KEYS.some((k) => typeof o[k] === 'boolean')) return null
  return {
    registre: Boolean(o.registre),
    incidents: Boolean(o.incidents),
    controles: Boolean(o.controles),
    audit: Boolean(o.audit),
    kri: Boolean(o.kri),
    reglementaire: Boolean(o.reglementaire),
  }
}

let mem: NavModules | null = null

/** Lecture SÛRE pour le rendu (SSR + 1er rendu client) : cache mémoire uniquement. */
export function peekNavModules(): NavModules | null {
  return mem
}

/** Lecture COMPLÈTE (effect client seulement) : mémoire, sinon localStorage. */
export function loadNavModules(): NavModules | null {
  if (mem) return mem
  if (typeof window === 'undefined') return null
  try {
    const parsed = parseNavModules(JSON.parse(localStorage.getItem(NAV_MODULES_STORAGE_KEY) ?? 'null'))
    if (parsed) mem = parsed
    return parsed
  } catch {
    return null
  }
}

/** Mémorise le dernier état connu (mémoire + localStorage). */
export function setCachedNavModules(m: NavModules): void {
  mem = m
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(NAV_MODULES_STORAGE_KEY, JSON.stringify(m))
  } catch {
    /* stockage indisponible (mode privé, quota) → cache mémoire seul */
  }
}

/** Test-only : réinitialise le cache mémoire. */
export function __resetNavModulesCacheForTest(): void {
  mem = null
}
