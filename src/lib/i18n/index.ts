/**
 * i18n/index.ts — Internationalisation entry point
 *
 * Architecture:
 *  - `fr.ts` is the source language and defines the `Translations` type via
 *    `typeof fr`. All other language files must satisfy this same shape.
 *  - The client-side context (`src/lib/i18n/context.tsx`) reads the user's
 *    locale from the `acra-locale` cookie and exposes `t` via `useTranslation()`.
 *  - Server components call `getServerT()` which reads the same cookie via
 *    `next/headers` (dynamic import to avoid SSR/client bundle cross-contamination).
 *
 * Adding a language:
 *  1. Copy `fr.ts` to `xx.ts` and translate all string values
 *  2. Import and re-export it below
 *  3. Add the locale to `LOCALES`, `LOCALE_LABELS`, `LOCALE_SHORT`
 *  4. Add it to the `localeMap` object
 *  5. Add the flag/label to `LanguageSwitcher.tsx`
 */
import { fr } from './fr'
import { en } from './en'
import { it } from './it'
import { es } from './es'
import { de } from './de'

export type { Translations } from './fr'
export { fr, en, it, es, de }

export type Locale = 'fr' | 'en' | 'it' | 'es' | 'de'

export const LOCALES: Locale[] = ['fr', 'en', 'it', 'es', 'de']

// Sans drapeaux emoji : les drapeaux régionaux ne s'affichent pas sur Windows
// (Segoe UI Emoji) et représentent mal une langue. Le nom suffit.
export const LOCALE_LABELS: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  it: 'Italiano',
  es: 'Español',
  de: 'Deutsch',
}

export const LOCALE_SHORT: Record<Locale, string> = {
  fr: 'FR',
  en: 'EN',
  it: 'IT',
  es: 'ES',
  de: 'DE',
}

const localeMap = { fr, en, it, es, de }

/**
 * Returns the translation object for a given locale code.
 * Falls back to French if the locale is unrecognised.
 *
 * @param locale - BCP 47 language tag or one of the supported `Locale` values
 * @returns Translation object typed as `typeof fr`
 */
export function getT(locale: Locale | string) {
  return localeMap[locale as Locale] ?? fr
}

/**
 * Server-only helper — reads the `acra-locale` cookie via `next/headers`
 * and returns the matching translation object.
 *
 * Use this in React Server Components and API route handlers.
 * Client components should use the `useTranslation()` hook from context.tsx instead.
 *
 * Falls back to French if the cookie is absent or unrecognised.
 */
export async function getServerT() {
  try {
    // Dynamic import to avoid bundling next/headers in client code
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const locale = cookieStore.get('acra-locale')?.value as Locale
    return getT(locale || 'fr')
  } catch {
    return fr
  }
}

/**
 * Server-only helper — retourne le code de langue courant (cookie `acra-locale`),
 * pour le formatage localisé des dates/nombres. Repli sur 'fr'.
 */
export async function getServerLocale(): Promise<Locale> {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const locale = cookieStore.get('acra-locale')?.value as Locale
    return LOCALES.includes(locale) ? locale : 'fr'
  } catch {
    return 'fr'
  }
}
