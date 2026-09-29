'use client'

import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { fr, getT, LOCALES, type Locale, type Translations } from './index'
import { applyVocabulaire, sanitizeVocabulaire, type Vocabulaire } from '@/lib/vocabulaire'

interface I18nCtx {
  locale:    Locale
  setLocale: (l: Locale) => void
  t:         Translations
  /** Recharge le vocabulaire de l'organisation (après une modification). */
  reloadVocabulaire: () => void
}

const I18nContext = createContext<I18nCtx>({
  locale:    'fr',
  setLocale: () => {},
  t:         fr,
  reloadVocabulaire: () => {},
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr')
  const router = useRouter()
  // Vocabulaire personnalisé de l'organisation (lot L5) : renomme des termes à l'AFFICHAGE seulement.
  const [vocab, setVocab] = useState<Vocabulaire>({})
  const reloadVocabulaire = useCallback(() => {
    fetch('/api/personnalisation').then(r => (r.ok ? r.json() : null)).then(d => setVocab(sanitizeVocabulaire(d?.vocabulaire))).catch(() => {})
  }, [])
  useEffect(() => { reloadVocabulaire() }, [reloadVocabulaire])
  const t = useMemo(() => applyVocabulaire(getT(locale), vocab, locale), [locale, vocab])

  useEffect(() => {
    // 1) Cookie `acra-locale` — source de vérité partagée avec les Server Components
    //    (getServerLocale). Le lire en premier évite toute divergence client/serveur.
    const cookieLocale = document.cookie.split('; ').find(c => c.startsWith('acra-locale='))?.split('=')[1] as Locale
    if (cookieLocale && LOCALES.includes(cookieLocale)) {
      setLocaleState(cookieLocale)
      localStorage.setItem('acra-locale', cookieLocale)
      return
    }
    // 2) Essaie localStorage (sessions antérieures)
    const stored = localStorage.getItem('acra-locale') as Locale
    if (stored && LOCALES.includes(stored)) {
      setLocaleState(stored)
      document.cookie = `acra-locale=${stored}; path=/; max-age=31536000; SameSite=Lax`
      return
    }
    // 3) Détection navigateur
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
    // Mémorise la préférence côté serveur (pour les e-mails hors session).
    // Best-effort : silencieux si non authentifié (401) ou hors ligne.
    fetch('/api/user/locale', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: l }),
    }).catch(() => {})
    setLocaleState(l)
    // Re-exécute les Server Components avec le nouveau cookie
    // (dashboard, analyses, et toutes les pages RSC relisent getServerT())
    router.refresh()
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, reloadVocabulaire }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  return useContext(I18nContext)
}
