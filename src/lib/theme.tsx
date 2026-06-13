'use client'

/**
 * Gestion du thème (clair / sombre / système).
 *
 * - Le choix est persité dans localStorage ('acra-theme').
 * - La classe 'dark' est posée sur <html> immédiatement (anti-FOUC via script
 *   inline dans layout.tsx).
 * - Le mode 'system' suit la media query prefers-color-scheme.
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'acra-theme'

interface ThemeContextValue {
  theme: ThemeMode
  setTheme: (mode: ThemeMode) => void
  /** true si le thème effectif appliqué est sombre (utile pour les icônes) */
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  setTheme: () => {},
  isDark: false,
})

function getEffectiveDark(mode: ThemeMode): boolean {
  if (mode === 'dark')  return true
  if (mode === 'light') return false
  // system
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(mode: ThemeMode) {
  const dark = getEffectiveDark(mode)
  document.documentElement.classList.toggle('dark', dark)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('system')

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) ?? 'system') as ThemeMode
    setThemeState(stored)
    applyTheme(stored)
  }, [])

  // Listen to system preference changes when mode = 'system'
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode)
    localStorage.setItem(STORAGE_KEY, mode)
    applyTheme(mode)
  }, [])

  const isDark = getEffectiveDark(theme)

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}

/**
 * Script inline à insérer dans <head> AVANT tout autre script pour éviter
 * le flash of unstyled content (FOUC) lors du rechargement de page.
 * À utiliser via dangerouslySetInnerHTML dans layout.tsx.
 */
export const THEME_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('acra-theme') || 'system';
    var dark = stored === 'dark' ||
      (stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`
