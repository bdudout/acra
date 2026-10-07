'use client'

// ─── Processus de cartographie des risques (lecture + édition gouvernance) ───
// Étapes numérotées (c'est une séquence), statut de revue de la cartographie
// (dernière mise à jour du registre + périodicité), et édition du texte par la
// gouvernance (PUT /api/cartographie/processus ; « défaut » = objet vide).

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { PERIODICITES, type ProcessusCarto, type Periodicite } from '@/lib/processus-carto'

export interface ProcessusFaits { derniereMaj: string | null; prochaineRevue: string | null; statut: 'JAMAIS' | 'A_JOUR' | 'BIENTOT' | 'EN_RETARD'; nbRisques: number }

const TON: Record<ProcessusFaits['statut'], string> = {
  JAMAIS: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
  A_JOUR: 'bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-200',
  BIENTOT: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200',
  EN_RETARD: 'bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-200',
}
const field = 'mt-1 block w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600'

export default function ProcessusCartoView({ processus, faits, canEdit }: { processus: ProcessusCarto; faits: ProcessusFaits; canEdit: boolean }) {
  const { t, locale } = useTranslation()
  const p = t.processusCarto
  const router = useRouter()
  const [edit, setEdit] = useState<ProcessusCarto | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale) : p.never)

  async function put(body: object) {
    setBusy(true); setMsg(null)
    const res = await fetch('/api/cartographie/processus', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    setBusy(false)
    if (!res || !res.ok) { setMsg(p.error.replace('{error}', String(res?.status ?? '—'))); return }
    setMsg(p.saved); setEdit(null); router.refresh()
  }

  const shown = edit ?? processus
  return (
    <div className="space-y-6">
      <section className={`rounded-lg px-4 py-3 text-sm ${TON[faits.statut]}`} role="status">
        <p className="font-semibold">{(p.statuts as Record<string, string>)[faits.statut]}</p>
        <p className="text-xs mt-0.5">
          {p.derniereMaj} : {fmt(faits.derniereMaj)} · {p.prochaineRevue} : {fmt(faits.prochaineRevue)} · {p.periodicite} : {(p.periodicites as Record<string, string>)[processus.periodicite]} · {p.nbRisques.replace('{n}', String(faits.nbRisques))}
        </p>
      </section>

      <section className="card p-6">
        {edit ? (
          <label className="text-xs text-gray-600 dark:text-gray-300 block">{p.introductionLabel}
            <textarea aria-label={p.introductionLabel} rows={3} value={edit.introduction ?? ''} onChange={e => setEdit({ ...edit, introduction: e.target.value })} className={field} />
          </label>
        ) : <p className="text-sm text-gray-700 dark:text-gray-200">{processus.introduction ?? p.introDefault}</p>}

        {edit && (
          <label className="mt-3 block text-xs text-gray-600 dark:text-gray-300 max-w-xs">{p.periodicite}
            <select aria-label={p.periodicite} value={edit.periodicite} onChange={e => setEdit({ ...edit, periodicite: e.target.value as Periodicite })} className={field}>
              {PERIODICITES.map(x => <option key={x} value={x}>{(p.periodicites as Record<string, string>)[x]}</option>)}
            </select>
          </label>
        )}

        <ol className="mt-5 space-y-4">
          {shown.etapes.map((e, i) => (
            <li key={e.key} className="flex gap-4">
              <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ebios-100 text-sm font-semibold text-ebios-800 dark:bg-ebios-900/40 dark:text-ebios-200">{i + 1}</span>
              <div className="flex-1">
                {edit ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input aria-label={`${e.titre} — titre`} value={e.titre} onChange={ev => setEdit({ ...edit, etapes: edit.etapes.map(x => x.key === e.key ? { ...x, titre: ev.target.value } : x) })} className={field} />
                    <input aria-label={`${processus.etapes[i].titre} — ${p.responsable}`} placeholder={p.responsable} value={e.responsable ?? ''} onChange={ev => setEdit({ ...edit, etapes: edit.etapes.map(x => x.key === e.key ? { ...x, responsable: ev.target.value } : x) })} className={field} />
                    <textarea aria-label={`${e.titre} — description`} rows={3} value={e.description} onChange={ev => setEdit({ ...edit, etapes: edit.etapes.map(x => x.key === e.key ? { ...x, description: ev.target.value } : x) })} className={`${field} sm:col-span-2`} />
                    <input aria-label={`${processus.etapes[i].titre} — ${p.frequence}`} placeholder={p.frequence} value={e.frequence ?? ''} onChange={ev => setEdit({ ...edit, etapes: edit.etapes.map(x => x.key === e.key ? { ...x, frequence: ev.target.value } : x) })} className={field} />
                  </div>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{e.titre}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{e.description}</p>
                    {(e.responsable || e.frequence) && (
                      <p className="text-xs text-gray-500 mt-1">{[e.responsable && `${p.responsable} : ${e.responsable}`, e.frequence && `${p.frequence} : ${e.frequence}`].filter(Boolean).join(' · ')}</p>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>

        {canEdit ? (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {edit ? (
              <>
                <button type="button" disabled={busy} onClick={() => put(edit)} className="btn-primary text-sm disabled:opacity-50">{p.save}</button>
                <button type="button" onClick={() => setEdit(null)} className="btn-secondary text-sm">{p.cancel}</button>
                <button type="button" disabled={busy} onClick={() => put({})} className="text-xs text-gray-600 hover:underline">{p.reset}</button>
              </>
            ) : <button type="button" onClick={() => { setMsg(null); setEdit(processus) }} className="btn-secondary text-sm">{p.edit}</button>}
            {msg && <span role="status" className="text-xs text-gray-600">{msg}</span>}
          </div>
        ) : <p className="mt-5 text-xs text-gray-500">{p.readOnly}</p>}
      </section>
    </div>
  )
}
