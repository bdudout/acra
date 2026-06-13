'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { fr, getT, LOCALES, type Locale, type Translations } from './index'

interface I18nCtx {
  locale:    Locale
  setLocale: (l: Locale) => void
  t:         Translations
}

const I18nContext = createContext<I18nCtx>({
  locale:    'fr',
  setLocale: () => {},
  t:         fr,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr')
  const router = useRouter()

  useEffect(() => {
    // 1) Essaie localStorage
    const stored = localStorage.getItem('acra-locale') as Locale
    if (stored && LOCALES.includes(stored)) {
      setLocaleState(stored)
      return
    }
    // 2) Détection navigateur
    const lang = navigator.language.split('-')[0] as Locale
    if (LOCALES.includes(lang)) setLocaleState(lang)
  }, [])

  // Synchronise <html lang> avec la locale active : WCAG 3.1.1 (langue de la page)
  // ET format des contrôles natifs (datetime-local, etc.) qui suivent l'attribut lang.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  function setLocale(l: Locale) {
    localStorage.setItem('acra-locale', l)
    // Cookie pour les server components
    document.cookie = `acra-locale=${l}; path=/; max-age=31536000; SameSite=Lax`
    setLocaleState(l)
    // Re-exécute les Server Components avec le nouveau cookie
    // (dashboard, analyses, et toutes les pages RSC relisent getServerT())
    router.refresh()
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: getT(locale) }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  return useContext(I18nContext)
}
