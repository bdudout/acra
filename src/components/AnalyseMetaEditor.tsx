'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { useEbiosData } from '@/lib/i18n/use-ebios-data'
import { normalizeSousSecteurs } from '@/lib/sous-secteurs'
import SousSecteursPicker from '@/components/SousSecteursPicker'
import PatternsArchiPicker from '@/components/PatternsArchiPicker'
import AutocompleteInput from '@/components/AutocompleteInput'

/**
 * Édition des métadonnées d'une analyse (nom, organisation, secteur, sous-secteur)
 * depuis sa page principale — permet de corriger un secteur/une organisation oubliés
 * (recette comité). PATCH /api/analyses/[id] puis rafraîchissement du composant serveur.
 */
export default function AnalyseMetaEditor({ analyseId, nom, organisation, secteur, sousSecteur, sousSecteurs, patternsArchi, canEdit }: {
  analyseId: string
  nom: string
  organisation: string | null
  secteur: string | null
  sousSecteur: string | null
  /** Sous-secteurs de l'analyse (le premier = principal) ; à défaut, l'ancien champ unique. */
  sousSecteurs?: string[]
  /** Patterns d'architecture de SI cochés (vision technique, indépendante du secteur). */
  patternsArchi?: string[]
  canEdit: boolean
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const { SECTEURS_ACTIVITE } = useEbiosData()
  const initialSS = sousSecteurs?.length ? sousSecteurs : sousSecteur ? [sousSecteur] : []
  const [open, setOpen] = useState(false)
  const initialPatterns = patternsArchi ?? []
  const [patternsMax, setPatternsMax] = useState(12)
  const [form, setForm] = useState({ nom, organisation: organisation ?? '', secteur: secteur ?? '', sousSecteurs: initialSS, patternsArchi: initialPatterns })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Plafond de sélection de l'organisation (lu à l'ouverture du formulaire).
  useEffect(() => {
    if (!open) return
    fetch('/api/admin/organization-config', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => { if (typeof d?.patternsArchiMax === 'number') setPatternsMax(d.patternsArchiMax) }).catch(() => {})
  }, [open])

  if (!canEdit) return null

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nom.trim()) { setError(t.newAnalysis.nameRequired); return }
    if (!form.organisation.trim()) { setError(t.newAnalysis.orgRequired); return }
    if (!form.secteur) { setError(t.newAnalysis.sectorRequired); return }
    setSaving(true); setError('')
    const res = await fetch(`/api/analyses/${analyseId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: form.nom, organisation: form.organisation, secteur: form.secteur, sousSecteurs: form.sousSecteurs, patternsArchi: form.patternsArchi }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || t.error); return }
    setOpen(false)
    router.refresh()
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-ebios-500'

  return (
    <>
      <button onClick={() => { setForm({ nom, organisation: organisation ?? '', secteur: secteur ?? '', sousSecteurs: initialSS, patternsArchi: initialPatterns }); setError(''); setOpen(true) }}
        className="text-gray-400 hover:text-ebios-600 p-1 align-[-0.15em]" aria-label={t.analysis.editMeta} title={t.analysis.editMeta}>
        <Pencil size={15} aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <form onSubmit={save} onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t.analysis.editMeta}</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label={t.cancel}><X size={18} aria-hidden="true" /></button>
            </div>

            {error && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 text-sm">{error}</div>}

            <label className="block">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t.newAnalysis.name} <span className="text-red-500">*</span></span>
              <input className={`mt-1 ${inputCls}`} value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} required />
            </label>

            <label className="block">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t.newAnalysis.org} <span className="text-red-500">*</span></span>
              <AutocompleteInput field="organisation" value={form.organisation}
                onChange={v => setForm({ ...form, organisation: v })} className={`mt-1 ${inputCls}`} />
            </label>

            <label className="block">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t.newAnalysis.sector} <span className="text-red-500">*</span></span>
              <select className={`mt-1 ${inputCls}`} value={form.secteur} required
                onChange={e => setForm({ ...form, secteur: e.target.value, sousSecteurs: normalizeSousSecteurs(e.target.value, form.sousSecteurs) })}>
                <option value="">{t.newAnalysis.sectorPh}</option>
                {SECTEURS_ACTIVITE.map((s: string) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>

            <SousSecteursPicker secteur={form.secteur} value={form.sousSecteurs} onChange={v => setForm({ ...form, sousSecteurs: v })} />

            <PatternsArchiPicker value={form.patternsArchi} max={patternsMax} onChange={v => setForm({ ...form, patternsArchi: v })} />

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">{t.cancel}</button>
              <button type="submit" disabled={saving} className="px-3 py-2 text-sm rounded-lg bg-ebios-600 hover:bg-ebios-700 text-white font-medium disabled:opacity-50">{saving ? t.workshop.saving : t.save}</button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
