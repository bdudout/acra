'use client'

import { useState, useRef, useEffect } from 'react'
import { Globe, ChevronDown, Check } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT } from '@/lib/i18n'

export default function LanguageSwitcher({ onDark = false }: { onDark?: boolean }) {
  const { locale, setLocale } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Fermeture sur Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Langue sélectionnée : ${LOCALE_LABELS[locale]}. Changer de langue`}
        className={`flex items-center gap-1 px-2 py-1.5 text-sm font-medium rounded-lg transition-colors ${
          onDark
            ? 'text-white/80 hover:text-white hover:bg-white/10'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        <Globe size={16} aria-hidden="true" />
        <span className="text-xs" aria-hidden="true">{LOCALE_SHORT[locale]}</span>
        <ChevronDown size={14} className={onDark ? 'text-white/60' : 'text-gray-500'} aria-hidden="true" />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Choisir une langue"
          aria-activedescendant={`lang-${locale}`}
          className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50 min-w-[160px] list-none p-0 m-0"
        >
          {LOCALES.map(l => (
            <li key={l} role="option" aria-selected={l === locale} id={`lang-${l}`}>
              <button
                onClick={() => { setLocale(l); setOpen(false) }}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                  l === locale
                    ? 'bg-ebios-50 text-ebios-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{LOCALE_LABELS[l]}</span>
                {l === locale && (
                  <Check size={14} className="ml-auto text-ebios-500" aria-label="langue sélectionnée" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
