'use client'

import { useEffect, useId, useState } from 'react'

interface Props {
  field: string
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
  required?: boolean
  id?: string
  'aria-label'?: string
}

/**
 * Champ texte avec autocomplétion native (<datalist>) alimentée par
 * /api/suggestions?field=… (valeurs déjà saisies dans le périmètre de
 * l'utilisateur). Récupère les suggestions à la 1ʳᵉ interaction (focus), une
 * fois — les ensembles (organisations, tags) sont petits. Dégrade proprement en
 * simple <input> si le fetch échoue.
 */
export default function AutocompleteInput({ field, value, onChange, className, placeholder, required, id, 'aria-label': ariaLabel }: Props) {
  const listId = useId()
  const [options, setOptions] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  async function loadOnce() {
    if (loaded) return
    setLoaded(true)
    try {
      const d = await fetch(`/api/suggestions?field=${encodeURIComponent(field)}`).then(r => (r.ok ? r.json() : { suggestions: [] }))
      if (Array.isArray(d.suggestions)) setOptions(d.suggestions)
    } catch { /* dégradation : input simple */ }
  }
  useEffect(() => () => { /* no-op cleanup */ }, [])

  return (
    <>
      <input
        type="text"
        id={id}
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={loadOnce}
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
