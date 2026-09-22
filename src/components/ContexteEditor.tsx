'use client'

// ─── Édition du contexte d'appréciation (saisie directe) ─────────────────────
// Phase « Établissement du contexte » (ISO 27005) / « Prepare » (NIST) : permet de
// renseigner le périmètre et les objectifs/critères, jusqu'ici en lecture seule.
// Persiste via PATCH /api/analyses/[id]/contexte (upsert Cadrage). Affiché quand la
// phase est éditable ; sinon la page rend la version lecture seule.

import { useState } from 'react'
import { Save } from 'lucide-react'

export default function ContexteEditor({
  analyseId, perimetre, objectifs,
  perimetreLabel, objectifsLabel, perimetrePlaceholder, objectifsPlaceholder, save, saved,
}: {
  analyseId: string
  perimetre?: string | null
  objectifs?: string | null
  perimetreLabel: string
  objectifsLabel: string
  perimetrePlaceholder?: string
  objectifsPlaceholder?: string
  save: string
  saved: string
}) {
  const [per, setPer] = useState(perimetre ?? '')
  const [obj, setObj] = useState(objectifs ?? '')
  // Baseline = dernières valeurs enregistrées (mises à jour après un save réussi).
  const [base, setBase] = useState({ per: perimetre ?? '', obj: objectifs ?? '' })
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(false)
  // Modifié tant que les champs diffèrent des dernières valeurs enregistrées.
  const dirty = per !== base.per || obj !== base.obj

  async function enregistrer() {
    if (!dirty || busy) return
    setBusy(true); setOk(false)
    const res = await fetch(`/api/analyses/${analyseId}/contexte`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ perimetre: per, objectifsEtude: obj }),
    }).catch(() => null)
    setBusy(false)
    if (res && res.ok) { setBase({ per, obj }); setOk(true) }
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">{perimetreLabel}
        <textarea value={per} onChange={e => { setPer(e.target.value); setOk(false) }} placeholder={perimetrePlaceholder} rows={2}
          className="block mt-1 w-full px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100" />
      </label>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">{objectifsLabel}
        <textarea value={obj} onChange={e => { setObj(e.target.value); setOk(false) }} placeholder={objectifsPlaceholder} rows={2}
          className="block mt-1 w-full px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100" />
      </label>
      <div className="flex items-center gap-3">
        <button type="button" onClick={enregistrer} disabled={!dirty || busy}
          className="btn-primary text-sm inline-flex items-center gap-1 disabled:opacity-50">
          <Save size={15} aria-hidden="true" /> {save}
        </button>
        {ok && <span className="text-xs text-green-600 dark:text-green-400">{saved}</span>}
      </div>
    </div>
  )
}
