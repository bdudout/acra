'use client'
// ─── Titre d'une analyse ou d'un projet 360, renommable en ligne (crayon) ─────
// PATCH /api/analyses/[id] { nom } (droit d'édition vérifié côté serveur), puis rafraîchissement de la page (fil
// d'Ariane, bascule analyse ⇄ projet). Entrée enregistre, Échap annule.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil, X } from 'lucide-react'

export interface TitreLabels { renommer: string; nom: string; enregistrer: string; annuler: string; erreur: string }

export default function TitreEditable({ analyseId, nom: initial, canEdit, labels: l, className = 'text-2xl font-bold text-gray-900 dark:text-gray-100', onRenamed }: {
  analyseId: string; nom: string; canEdit: boolean; labels: TitreLabels; className?: string; onRenamed?: (nom: string) => void
}) {
  const router = useRouter()
  const [nom, setNom] = useState(initial)
  const [edition, setEdition] = useState<string | null>(null)
  const [erreur, setErreur] = useState(false)

  async function enregistrer() {
    const v = (edition ?? '').trim()
    if (!v) return
    const res = await fetch(`/api/analyses/${analyseId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nom: v }) }).catch(() => null)
    if (!res?.ok) { setErreur(true); return }
    setNom(v); setEdition(null); setErreur(false)
    onRenamed?.(v)
    router.refresh()
  }

  if (edition === null) return (
    <h1 className={`flex items-center gap-2 ${className}`}>
      <span>{nom}</span>
      {canEdit && <button type="button" aria-label={l.renommer} title={l.renommer} onClick={() => setEdition(nom)} className="p-1 text-gray-400 hover:text-ebios-700"><Pencil size={16} aria-hidden="true" /></button>}
    </h1>
  )
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input aria-label={l.nom} value={edition} maxLength={200} autoFocus onChange={e => setEdition(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') enregistrer(); if (e.key === 'Escape') { setEdition(null); setErreur(false) } }}
        className="min-w-[18rem] rounded border border-gray-300 bg-white px-2 py-1 text-xl font-bold dark:border-gray-600 dark:bg-gray-800" />
      <button type="button" aria-label={l.enregistrer} onClick={enregistrer} disabled={!edition.trim()} className="p-1 text-green-700 disabled:opacity-40"><Check size={18} aria-hidden="true" /></button>
      <button type="button" aria-label={l.annuler} onClick={() => { setEdition(null); setErreur(false) }} className="p-1 text-gray-400"><X size={18} aria-hidden="true" /></button>
      {erreur && <span role="alert" className="text-xs text-red-600">{l.erreur}</span>}
    </div>
  )
}
