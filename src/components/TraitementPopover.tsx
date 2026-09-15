'use client'

// Popover de traitement RÉEL d'un écart de conformité (plan d'action, dérogation,
// acceptation de risque) au niveau du socle d'organisation.
//
// Un seul flux : on recherche en autocomplétion un traitement EXISTANT du même
// type (plan d'action / dérogation) ; le sélectionner préremplit les champs et
// bascule le bouton « Créer » en « Mettre à jour » (le libellé d'un traitement
// existant n'est PAS modifiable ici). Sans sélection, on crée un traitement neuf
// couvrant l'exigence. Un traitement peut couvrir plusieurs exigences (`refs`).

import { useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { entryTagForType, type TraitementType } from '@/lib/conformite-traitement'
import type { ConformiteTraitement as EntryTag } from '@/lib/conformite'

export interface ExistingTraitement {
  id: string
  type: string
  intitule: string
  refs: string[]
  description?: string | null
  responsable?: string | null
  echeance?: string | null
  statut?: string
  niveauRisqueMaintenu?: boolean
  niveauRisque?: string | null
}

export default function TraitementPopover({ orgId, referentiel, entite, controlRef, controlNom, type, existing, onApplied, onClose }: {
  orgId: string
  referentiel: string
  entite: string
  controlRef: string
  controlNom: string
  type: TraitementType
  existing: ExistingTraitement[]
  onApplied: (tag: EntryTag) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const u = t.conformite.traitementUI
  const typeLabel = (t.conformite.traitements as Record<string, string>)[entryTagForType(type)] ?? type
  const defaultTitle = `${typeLabel} — ${controlRef}`
  // Traitements existants du même type = candidats au rattachement/mise à jour.
  const sameType = useMemo(() => existing.filter(x => x.type === type), [existing, type])

  // Champ de recherche/intitulé : vide au départ → focus = tous les existants,
  // saisie = filtre. En création sans saisie, on retombe sur un libellé par défaut.
  const [intitule, setIntitule] = useState('')
  const [responsable, setResponsable] = useState('')
  const [echeance, setEcheance] = useState('')
  const [description, setDescription] = useState('')
  const [maintien, setMaintien] = useState(false)
  const [niveau, setNiveau] = useState('')
  // id du traitement existant sélectionné (null = création d'un nouveau).
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const base = `/api/organizations/${orgId}/conformite/traitements`
  const isUpdate = selectedId != null

  // Suggestions : filtre par intitulé (insensible casse), hors traitement déjà
  // sélectionné, limité pour rester lisible.
  const suggestions = useMemo(() => {
    if (isUpdate) return []
    const q = intitule.trim().toLowerCase()
    return sameType.filter(x => !q || x.intitule.toLowerCase().includes(q)).slice(0, 8)
  }, [sameType, intitule, isUpdate])

  function selectExisting(x: ExistingTraitement) {
    setSelectedId(x.id)
    setIntitule(x.intitule)
    setResponsable(x.responsable ?? '')
    setEcheance(x.echeance ? x.echeance.slice(0, 10) : '')
    setDescription(x.description ?? '')
    setMaintien(Boolean(x.niveauRisqueMaintenu))
    setNiveau(x.niveauRisque ?? '')
    setOpen(false)
    setError(null)
  }

  // Repasse en création d'un nouveau traitement (réinitialise les champs).
  function resetToNew() {
    setSelectedId(null)
    setIntitule('')
    setResponsable(''); setEcheance(''); setDescription(''); setMaintien(false); setNiveau('')
    setError(null)
  }

  async function submit() {
    if (isUpdate) {
      // Mise à jour : on ne touche PAS au libellé ; on rattache aussi cette exigence.
      setBusy(true); setError(null)
      const res = await fetch(`${base}/${selectedId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description, responsable, echeance, addRef: controlRef,
          ...(type === 'ACCEPTATION_RISQUE' ? { niveauRisqueMaintenu: maintien, niveauRisque: niveau } : {}),
        }),
      })
      setBusy(false)
      if (!res.ok) { setError(u.error); return }
      onApplied(entryTagForType(type))
      return
    }
    setBusy(true); setError(null)
    const res = await fetch(base, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referentiel, entite, type, intitule: intitule.trim() || defaultTitle, description, responsable, echeance,
        refs: [controlRef],
        ...(type === 'ACCEPTATION_RISQUE' ? { niveauRisqueMaintenu: maintien, niveauRisque: niveau } : {}),
      }),
    })
    setBusy(false)
    if (!res.ok) { setError(u.error); return }
    onApplied(entryTagForType(type))
  }

  const inputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100'

  return (
    <div className="mt-2 p-3 rounded-lg border border-ebios-200 bg-ebios-50/60 dark:border-ebios-500/30 dark:bg-ebios-500/10 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ebios-800 dark:text-ebios-200">{typeLabel} · {controlRef}</span>
        <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
      </div>

      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}

      <div className="space-y-1.5">
        {/* Recherche/intitulé : en création, tape le libellé OU choisis un existant ;
            en mise à jour, le libellé est verrouillé (non modifiable ici). */}
        <div className="relative">
          <input
            value={intitule}
            onChange={e => { if (!isUpdate) { setIntitule(e.target.value); setOpen(true) } }}
            onFocus={() => { if (!isUpdate && sameType.length > 0) setOpen(true) }}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            readOnly={isUpdate}
            placeholder={u.searchExisting}
            aria-label={u.intitule}
            className={`${inputCls} ${isUpdate ? 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed' : ''}`}
          />
          {open && suggestions.length > 0 && (
            <ul className="absolute z-10 left-0 right-0 mt-0.5 max-h-44 overflow-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg text-xs">
              {suggestions.map(x => (
                <li key={x.id}>
                  <button type="button" onMouseDown={e => { e.preventDefault(); selectExisting(x) }}
                    className="w-full text-left px-2 py-1.5 hover:bg-ebios-50 dark:hover:bg-ebios-500/10 flex items-center justify-between gap-2">
                    <span className="truncate text-gray-800 dark:text-gray-100">{x.intitule}</span>
                    <span className="shrink-0 text-[10px] text-gray-400">{u.covers.replace('{n}', String(x.refs.length))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {isUpdate && (
          <div className="flex items-center justify-between text-[11px] text-ebios-700 dark:text-ebios-300">
            <span className="truncate">{u.lockedHint}</span>
            <button type="button" onClick={resetToNew} className="shrink-0 text-gray-500 hover:text-gray-700 underline">{u.newInstead}</button>
          </div>
        )}

        <div className="flex gap-1.5">
          <input value={responsable} onChange={e => setResponsable(e.target.value)} placeholder={u.responsable} className={inputCls} />
          <input type="date" value={echeance} onChange={e => setEcheance(e.target.value)} title={u.echeance} className={inputCls} />
        </div>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={u.descriptionLabel} rows={2} className={inputCls} />
        {type === 'ACCEPTATION_RISQUE' && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={maintien} onChange={e => setMaintien(e.target.checked)} /> {u.niveauRisqueMaintenu}
            </label>
            <input value={niveau} onChange={e => setNiveau(e.target.value)} placeholder={u.niveauRisquePh} className={`${inputCls} flex-1 min-w-[8rem]`} />
          </div>
        )}
        <div className="flex gap-2 pt-0.5">
          <button type="button" disabled={busy} onClick={submit}
            className="text-xs px-3 py-1 rounded bg-ebios-600 text-white font-medium disabled:opacity-50">
            {busy ? u.creating : isUpdate ? u.update : u.create}
          </button>
          <button type="button" onClick={onClose} className="text-xs px-2.5 py-1 rounded text-gray-500 hover:text-gray-700">{u.cancel}</button>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 truncate">{controlNom}</p>
    </div>
  )
}
