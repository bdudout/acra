'use client'

// ─── Lancement d'un projet 360 (page dédiée /projets/nouveau) ────────────────
// Comme « Nouvelle analyse » : nom, périmètre, OBJECTIFS (repris dans le contexte du projet, phase 1), secteur et
// patterns d'architecture ; l'analyse PROJET_360 est créée puis peuplée côté serveur (questionnaire pré-rempli, risques
// proposés sans doublon) et l'utilisateur est conduit à la qualification pour confirmer.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { useEbiosData } from '@/lib/i18n/use-ebios-data'
import ExampleChips from '@/components/ExampleChips'
import ModuleGuide from '@/components/ModuleGuide'
import PatternsArchiPicker from '@/components/PatternsArchiPicker'

const qualifHref = (id: string) => `/analyses/${id}/atelier/1?phase=qualification`
const field = 'mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600'

export default function NouveauProjet360({ maxPatterns, hiddenPatterns }: { maxPatterns: number; hiddenPatterns?: readonly string[] }) {
  const { t } = useTranslation()
  const { SECTEURS_ACTIVITE } = useEbiosData()
  const p = t.projets
  const router = useRouter()
  const [nom, setNom] = useState('')
  const [description, setDescription] = useState('')
  const [objectifs, setObjectifs] = useState('')
  const [secteur, setSecteur] = useState('')
  const [patternsArchi, setPatternsArchi] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function create() {
    setBusy(true); setMsg(null)
    const res = await fetch('/api/analyses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom: nom.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(objectifs.trim() ? { objectifsEtude: objectifs.trim() } : {}),
        secteur, patternsArchi, methode: 'PROJET_360',
      }),
    }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    if (!res || !res.ok || !d?.analyse?.id) { setBusy(false); setMsg(p.error.replace('{error}', String(d?.error ?? res?.status ?? '—'))); return }
    router.push(qualifHref(d.analyse.id))
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/projets" className="text-sm text-ebios-700 hover:underline">{p.back}</Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{p.newTitle}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{p.newSubtitle}</p>
      </div>
      <ModuleGuide guide={p.guide} />
      <section className="card p-5 space-y-3" aria-label={p.newTitle}>
        <ExampleChips items={p.examples.map((e, i) => ({ id: String(i), label: e.nom }))}
          onPick={id => { const e = p.examples[Number(id)]; if (e) { setNom(e.nom); setDescription(e.description) } }} />
        <label className="block text-xs text-gray-600 dark:text-gray-300">{p.nom}
          <input aria-label={p.nom} value={nom} maxLength={200} placeholder={p.nomPlaceholder} onChange={e => setNom(e.target.value)} className={field} />
        </label>
        <label className="block text-xs text-gray-600 dark:text-gray-300">{p.description}
          <textarea aria-label={p.description} rows={3} maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} className={field} />
        </label>
        <label className="block text-xs text-gray-600 dark:text-gray-300">{p.objectifs}
          <textarea aria-label={p.objectifs} rows={2} maxLength={2000} value={objectifs} placeholder={p.objectifsPlaceholder} onChange={e => setObjectifs(e.target.value)} className={field} />
          <span className="mt-0.5 block text-[11px] text-gray-400">{p.objectifsHint}</span>
        </label>
        <label htmlFor="projet-secteur" className="block text-xs text-gray-600 dark:text-gray-300">{t.newAnalysis.sector} <span className="text-red-500">*</span>
          <select id="projet-secteur" required value={secteur} onChange={e => setSecteur(e.target.value)} className={field}>
            <option value="">{t.newAnalysis.sectorPh}</option>
            {SECTEURS_ACTIVITE.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <PatternsArchiPicker value={patternsArchi} onChange={setPatternsArchi} max={maxPatterns} hiddenCodes={hiddenPatterns ? [...hiddenPatterns] : []} required />
        <p className="text-xs text-gray-500">{p.createHint}</p>
        <div className="flex items-center gap-2">
          <button type="button" disabled={busy || !nom.trim() || !secteur || !patternsArchi.length} onClick={create} className="btn-primary text-sm disabled:opacity-50">{p.create}</button>
          <Link href="/projets" className="btn-secondary text-sm">{p.cancel}</Link>
          {msg && <span role="status" className="text-xs text-red-700">{msg}</span>}
        </div>
      </section>
    </div>
  )
}
