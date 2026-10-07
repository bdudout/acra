'use client'
// ─── Documents d'un projet 360 (phase 1) : schémas, documents d'architecture, dossiers projet ─
// Liste (téléchargement authentifié), dépôt et suppression via /api/analyses/[id]/fichiers (lib/fichiers-projet) ;
// lecture seule sans droit d'édition.

import { useEffect, useRef, useState } from 'react'
import { Download, Paperclip, Trash2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { FICHIER_PROJET_TYPES } from '@/lib/fichiers-projet'
import { MAX_DOCUMENT_SIZE } from '@/lib/document'

interface Fichier { id: string; titre: string; type: string; fichierNom: string; mime: string; taille: number; createdAt: string }
const field = 'rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600'

export default function FichiersProjet({ analyseId, editable }: { analyseId: string; editable: boolean }) {
  const { t } = useTranslation()
  const f = t.projet360.fichiers
  const types = f.types as Record<string, string>
  const [fichiers, setFichiers] = useState<Fichier[] | null>(null)
  const [type, setType] = useState<string>('SCHEMA')
  const [titre, setTitre] = useState('')
  const [fichier, setFichier] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const base = `/api/analyses/${analyseId}/fichiers`

  useEffect(() => {
    fetch(base, { cache: 'no-store' }).then(r => (r.ok ? r.json() : { fichiers: [] })).then(d => setFichiers(d.fichiers ?? [])).catch(() => setFichiers([]))
  }, [base])

  const taille = (o: number) => (o >= 1024 * 1024 ? `${(o / 1024 / 1024).toFixed(1)} ${f.mo}` : `${Math.max(1, Math.round(o / 1024))} ${f.ko}`)

  async function deposer() {
    if (!fichier) return
    if (fichier.size > MAX_DOCUMENT_SIZE) { setErreur(true); return }
    setBusy(true); setErreur(false)
    const fd = new FormData()
    fd.set('file', fichier); fd.set('type', type); if (titre.trim()) fd.set('titre', titre.trim())
    const res = await fetch(base, { method: 'POST', body: fd }).catch(() => null)
    setBusy(false)
    if (!res?.ok) { setErreur(true); return }
    const d = await res.json()
    setFichiers(l => [d.fichier, ...(l ?? [])])
    setTitre(''); setFichier(null); if (input.current) input.current.value = ''
  }
  async function supprimer(id: string) {
    const res = await fetch(`${base}/${id}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) setFichiers(l => (l ?? []).filter(x => x.id !== id))
  }

  return (
    <section className="card mt-5 p-6">
      <h2 className="flex items-center gap-1.5 text-base font-semibold text-gray-800 dark:text-gray-100"><Paperclip size={16} aria-hidden="true" />{f.title}</h2>
      <p className="mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400">{f.intro}</p>
      {fichiers == null ? null : fichiers.length === 0 ? <p className="text-sm italic text-gray-400">{f.vide}</p> : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {fichiers.map(x => (
            <li key={x.id} className="flex items-center gap-3 py-2 text-sm">
              <a href={`${base}/${x.id}`} className="flex flex-1 items-center gap-1.5 text-ebios-700 hover:underline"><Download size={14} aria-hidden="true" />{x.titre}</a>
              <span className="text-xs text-gray-500">{types[x.type] ?? x.type} · {x.fichierNom} · {taille(x.taille)}</span>
              {editable && <button type="button" aria-label={`${f.supprimer} — ${x.titre}`} onClick={() => supprimer(x.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} aria-hidden="true" /></button>}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
          <label className="text-xs text-gray-600 dark:text-gray-300">{f.nature}
            <select aria-label={f.nature} value={type} onChange={e => setType(e.target.value)} className={`${field} mt-1 block`}>
              {FICHIER_PROJET_TYPES.map(k => <option key={k} value={k}>{types[k]}</option>)}
            </select>
          </label>
          <label className="min-w-[12rem] flex-1 text-xs text-gray-600 dark:text-gray-300">{f.titre}
            <input aria-label={f.titre} value={titre} maxLength={200} onChange={e => setTitre(e.target.value)} className={`${field} mt-1 block w-full`} />
          </label>
          <label className="text-xs text-gray-600 dark:text-gray-300">{f.fichier}
            <input ref={input} aria-label={f.fichier} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.md,.csv,.png,.jpg,.jpeg" onChange={e => { setFichier(e.target.files?.[0] ?? null); setErreur(false) }} className="mt-1 block text-sm" />
          </label>
          <button type="button" disabled={!fichier || busy} onClick={deposer} className="btn-secondary text-sm disabled:opacity-50">{f.ajouter}</button>
          {erreur && <p role="alert" className="w-full text-xs text-red-600">{f.erreur}</p>}
        </div>
      )}
    </section>
  )
}
