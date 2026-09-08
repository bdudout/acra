'use client'

import { useEffect, useId, useRef, useState } from 'react'

interface Props {
  field: string
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
  required?: boolean
  id?: string
  'aria-label'?: string
  /** Locale (pour les suggestions issues des référentiels). */
  lang?: string
}

/**
 * Champ texte avec autocomplétion native (<datalist>) alimentée par
 * /api/suggestions?field=…&q=… — valeurs déjà saisies dans le périmètre de
 * l'utilisateur ENRICHIES, pour les mesures, des exigences/contrôles des
 * référentiels. Piloté par la requête : refetch (debounced) à la frappe, pour
 * ramener les meilleures correspondances (et pas seulement 8 items alphabétiques).
 * Dégrade proprement en simple <input> si le fetch échoue.
 */
export default function AutocompleteInput({ field, value, onChange, className, placeholder, required, id, 'aria-label': ariaLabel, lang }: Props) {
  const listId = useId()
  const [options, setOptions] = useState<string[]>([])
  const [active, setActive] = useState(false) // le champ a reçu le focus au moins une fois
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function fetchSuggestions(q: string) {
    try {
      const params = new URLSearchParams({ field, q, limit: '12' })
      if (lang) params.set('lang', lang)
      const d = await fetch(`/api/suggestions?${params.toString()}`).then(r => (r.ok ? r.json() : { suggestions: [] }))
      if (Array.isArray(d.suggestions)) setOptions(d.suggestions)
    } catch { /* dégradation : input simple */ }
  }

  // Refetch (debounced) à la frappe, une fois le champ activé.
  useEffect(() => {
    if (!active) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { fetchSuggestions(value) }, 180)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, active])

  return (
    <>
      <input
        type="text"
        id={id}
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setActive(true)}
        list={listId}
        autoComplete="off"
        className={className}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      <datalist id={listId}>
        {options.map(o => <option key={o} value={o} />)}
      </datalist>
    </>
  )
}
