'use client'

// ─── Onglet Projets : projets 360 (analyses PROJET_360) ──────────────────────
// Liste des projets de l'organisation active et lancement d'un projet 360 :
// l'analyse est créée avec la méthode PROJET_360 puis peuplée côté serveur à partir
// des données existantes (questionnaire pré-rempli, risques proposés sans doublon),
// et l'utilisateur est conduit à l'étape de qualification pour confirmer.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { useEbiosData } from '@/lib/i18n/use-ebios-data'
import ExampleChips from '@/components/ExampleChips'
import ModuleGuide from '@/components/ModuleGuide'
import PatternsArchiPicker from '@/components/PatternsArchiPicker'

export interface ProjetRow { id: string; nom: string; statut: string; risques: number; updatedAt: string; analyses?: { id: string; nom: string }[] }

const qualifHref = (id: string) => `/analyses/${id}/atelier/1?phase=qualification`
const field = 'mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600'

export default function ProjetsManager({ projets, canCreate }: { projets: ProjetRow[]; canCreate: boolean }) {
  const { t, locale } = useTranslation()
  const { SECTEURS_ACTIVITE } = useEbiosData()
  const p = t.projets
  const router = useRouter()
  const searchParams = useSearchParams()
  // ?nouveau=1 (menu « Nouveau projet 360 ») : le formulaire de création s'ouvre directement.
  const [open, setOpen] = useState(() => canCreate && searchParams.get('nouveau') === '1')
  const [nom, setNom] = useState('')
  const [description, setDescription] = useState('')
  const [secteur, setSecteur] = useState('')
  const [patternsArchi, setPatternsArchi] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function create() {
    setBusy(true); setMsg(null)
    const res = await fetch('/api/analyses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: nom.trim(), ...(description.trim() ? { description: description.trim() } : {}), secteur, patternsArchi, methode: 'PROJET_360' }),
    }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    setBusy(false)
    if (!res || !res.ok || !d?.analyse?.id) { setMsg(p.error.replace('{error}', String(d?.error ?? res?.status ?? '—'))); return }
    router.push(qualifHref(d.analyse.id))
  }

  return (
    <div className="space-y-5">
      <ModuleGuide guide={p.guide} />
      {canCreate && !open && (
        <button type="button" onClick={() => setOpen(true)} className="btn-primary text-sm inline-flex items-center gap-1.5"><Plus size={15} aria-hidden="true" />{p.launch}</button>
      )}
      {open && (
        <section className="card p-5 space-y-3" aria-label={p.launch}>
          <ExampleChips items={p.examples.map((e, i) => ({ id: String(i), label: e.nom }))}
            onPick={id => { const e = p.examples[Number(id)]; if (e) { setNom(e.nom); setDescription(e.description) } }} />
          <label className="block text-xs text-gray-600 dark:text-gray-300">{p.nom}
            <input aria-label={p.nom} value={nom} maxLength={200} placeholder={p.nomPlaceholder} onChange={e => setNom(e.target.value)} className={field} />
          </label>
          <label className="block text-xs text-gray-600 dark:text-gray-300">{p.description}
            <textarea aria-label={p.description} rows={3} maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} className={field} />
          </label>
          <label className="block text-xs text-gray-600 dark:text-gray-300">{t.newAnalysis.sector} <span className="text-red-500">*</span>
            <select aria-label={t.newAnalysis.sector} required value={secteur} onChange={e => setSecteur(e.target.value)} className={field}>
              <option value="">{t.newAnalysis.sectorPh}</option>
              {SECTEURS_ACTIVITE.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <PatternsArchiPicker value={patternsArchi} onChange={setPatternsArchi} max={12} required />
          <p className="text-xs text-gray-500">{p.createHint}</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={busy || !nom.trim() || !secteur || !patternsArchi.length} onClick={create} className="btn-primary text-sm disabled:opacity-50">{p.create}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-sm">{p.cancel}</button>
            {msg && <span role="status" className="text-xs text-red-700">{msg}</span>}
          </div>
        </section>
      )}
      <div className="card overflow-x-auto">
        {projets.length === 0 ? <p className="p-5 text-sm italic text-gray-400">{p.empty}</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-2">{p.colNom}</th><th className="px-4 py-2">{p.colStatut}</th>
              <th className="px-4 py-2">{p.colRisques}</th><th className="px-4 py-2">{p.colAnalyses}</th><th className="px-4 py-2">{p.colMaj}</th>
            </tr></thead>
            <tbody>
              {projets.map(pr => (
                <tr key={pr.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2 font-medium"><Link href={qualifHref(pr.id)} className="text-ebios-700 hover:underline">{pr.nom}</Link></td>
                  <td className="px-4 py-2 text-xs">{(t.statusLabels as Record<string, string>)[pr.statut] ?? pr.statut}</td>
                  <td className="px-4 py-2 tabular-nums">{pr.risques}</td>
                  <td className="px-4 py-2 text-xs">
                    <ul className="space-y-0.5">
                      {(pr.analyses ?? []).map(a => <li key={a.id}><Link href={`/analyses/${a.id}`} className="text-ebios-700 hover:underline">{a.nom}</Link></li>)}
                    </ul>
                    {canCreate && <Link href={`/analyses/new?projet=${pr.id}`} title={p.startCyberTitle} className="mt-1 inline-flex items-center gap-1 rounded border border-ebios-300 px-2 py-0.5 font-medium text-ebios-700 hover:bg-ebios-50 dark:border-ebios-700 dark:hover:bg-gray-800">{p.startCyber}</Link>}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">{new Date(pr.updatedAt).toLocaleDateString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
