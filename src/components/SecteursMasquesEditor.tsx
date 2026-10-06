'use client'
// ─── Configuration : secteurs d'activité masqués pour l'organisation (ADMIN) ──
// Case cochée = secteur proposé, dans la langue affichée ; enregistrement immédiat du libellé français canonique (lib/secteurs-masques) via
// PUT /api/admin/organization-config ; en cas d'échec, l'état précédent est rétabli.

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { getEbiosData } from '@/lib/ebios-data-i18n'
import { SECTEURS_ACTIVITE } from '@/lib/ebios-data'
import { normalizeSecteursMasques } from '@/lib/secteurs-masques'

export default function SecteursMasquesEditor({ initial }: { initial: readonly string[] }) {
  const { t, locale } = useTranslation()
  const l = t.secteursMasques
  const localises = getEbiosData(locale).SECTEURS_ACTIVITE as readonly string[]
  const [masques, setMasques] = useState<string[]>(normalizeSecteursMasques(initial))
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState(false)

  async function basculer(canonique: string) {
    const avant = masques
    const next = normalizeSecteursMasques(avant.includes(canonique) ? avant.filter(x => x !== canonique) : [...avant, canonique])
    if (next.length === avant.length && !avant.includes(canonique)) return // tout masquer est refusé
    setMasques(next); setBusy(true); setErreur(false)
    const res = await fetch('/api/admin/organization-config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secteursMasques: next }) }).catch(() => null)
    setBusy(false)
    if (!res?.ok) { setMasques(avant); setErreur(true) }
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">{l.title}</legend>
      <p className="mt-1 text-xs text-gray-500">{l.help}</p>
      {erreur && <p role="alert" className="mt-1 text-xs text-red-600">{l.erreur}</p>}
      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        {SECTEURS_ACTIVITE.map((canonique, i) => (
          <label key={canonique} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={!masques.includes(canonique)} disabled={busy} onChange={() => void basculer(canonique)} />
            {localises[i] ?? canonique}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
