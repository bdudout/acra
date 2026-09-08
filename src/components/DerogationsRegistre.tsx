'use client'

import { IdCard, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { formatDate } from '@/lib/format'
import AutocompleteInput from '@/components/AutocompleteInput'
import { etatDerogation, joursAvantExpiration, type DerogationEtat, type DerogationStatut } from '@/lib/derogation'

export interface RegistreRow {
  id: string
  analyseId: string | null
  analyseNom: string | null
  portee: string
  referentiel: string | null
  ref: string | null
  intitule: string
  statut: string
  dateFin: string | null
}

const BADGE: Record<DerogationEtat, string> = {
  DEMANDEE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  DOUBLE_REGARD: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  VALIDATION_METIER: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  EXPIRE_BIENTOT: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  EXPIREE: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  REJETEE: 'bg-gray-200 text-gray-700 dark:bg-gray-600/40 dark:text-gray-300',
  CLOTUREE: 'bg-slate-200 text-slate-700 dark:bg-slate-600/40 dark:text-slate-200',
  REVOQUEE: 'bg-gray-200 text-gray-700 dark:bg-gray-600/40 dark:text-gray-300',
}

// Fenêtre d'alerte par défaut pour l'affichage du registre (le seuil précis par
// organisation pilote les e-mails, pas cet aperçu).
const ALERTE_DEFAUT = 30

type Filtre = 'EN_COURS_EXP' | 'EN_COURS' | 'EXPIREES' | 'EN_REVUE' | 'CLOTUREES'

const REVIEW = ['DEMANDEE', 'DOUBLE_REGARD', 'VALIDATION_METIER']
const TERMINAL = ['CLOTUREE', 'REJETEE', 'REVOQUEE']
// Prédicat d'appartenance d'une ligne (état effectif calculé) à un filtre.
function matchFiltre(f: Filtre, statut: string, etat: DerogationEtat): boolean {
  switch (f) {
    case 'EN_COURS_EXP': return etat === 'ACTIVE' || etat === 'EXPIRE_BIENTOT' || etat === 'EXPIREE'
    case 'EN_COURS':     return etat === 'ACTIVE' || etat === 'EXPIRE_BIENTOT'
    case 'EXPIREES':     return etat === 'EXPIREE'
    case 'EN_REVUE':     return REVIEW.includes(statut)
    case 'CLOTUREES':    return TERMINAL.includes(statut)
  }
}

export default function DerogationsRegistre({ rows, locale, canCreate = false, dureeDefaut = 180, dureeMax = 365 }: { rows: RegistreRow[]; locale: string; canCreate?: boolean; dureeDefaut?: number; dureeMax?: number }) {
  const { t } = useTranslation()
  const d = t.derogations
  const router = useRouter()
  const [filtre, setFiltre] = useState<Filtre>('EN_COURS_EXP')
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ referentiel: '', ref: '', intitule: '', motif: '', mesures: '', dureeJours: '' })
  const [refs, setRefs] = useState<{ code: string; nom: string }[]>([])
  const [exigences, setExigences] = useState<{ ref: string; nom: string }[]>([])

  // Référentiels de l'org (pour choisir une mesure de référentiel existant).
  useEffect(() => {
    if (!creating) return
    fetch('/api/referentiels').then(r => r.ok ? r.json() : null).then(dd => {
      if (Array.isArray(dd?.referentiels)) setRefs(dd.referentiels.map((x: { code: string; nom: string }) => ({ code: x.code, nom: x.nom })))
    }).catch(() => { /* repli texte libre */ })
  }, [creating])

  useEffect(() => {
    if (!form.referentiel || !refs.some(r => r.code === form.referentiel)) { setExigences([]); return }
    fetch(`/api/referentiels/exigences?code=${encodeURIComponent(form.referentiel)}`).then(r => r.ok ? r.json() : null).then(dd => {
      if (Array.isArray(dd?.exigences)) setExigences(dd.exigences.map((e: { ref: string; nom: string }) => ({ ref: e.ref, nom: e.nom })))
    }).catch(() => setExigences([]))
  }, [form.referentiel, refs])

  async function submitCreate() {
    setBusy(true); setError(null)
    const res = await fetch('/api/derogations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portee: 'CONTROLE', referentiel: form.referentiel, ref: form.ref, intitule: form.intitule, motif: form.motif, mesuresCompensatoires: form.mesures, dureeJours: form.dureeJours ? Number(form.dureeJours) : undefined }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError((d.errors as Record<string, string>)[data.error] ?? data.error ?? 'Erreur'); return }
    setCreating(false); setForm({ referentiel: '', ref: '', intitule: '', motif: '', mesures: '', dureeJours: '' })
    router.refresh()
  }

  const enriched = useMemo(() => rows.map(r => ({
    ...r,
    etat: etatDerogation({ statut: r.statut as DerogationStatut, dateFin: r.dateFin }, ALERTE_DEFAUT),
    jours: joursAvantExpiration(r.dateFin),
  })), [rows])

  const filtered = useMemo(() => enriched.filter(r => matchFiltre(filtre, r.statut, r.etat)), [enriched, filtre])
  const count = (f: Filtre) => enriched.filter(r => matchFiltre(f, r.statut, r.etat)).length

  const filtres: { key: Filtre; label: string }[] = [
    { key: 'EN_COURS_EXP', label: `${d.filterCurrentExpired} (${count('EN_COURS_EXP')})` },
    { key: 'EN_COURS', label: `${d.filterCurrent} (${count('EN_COURS')})` },
    { key: 'EXPIREES', label: `${d.filterExpired} (${count('EXPIREES')})` },
    { key: 'EN_REVUE', label: `${d.filterReview} (${count('EN_REVUE')})` },
    { key: 'CLOTUREES', label: `${d.filterClosed} (${count('CLOTUREES')})` },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100"><IdCard size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" /> {d.title}</h1>
        {canCreate && (
          <button onClick={() => setCreating(v => !v)} className="btn-primary text-sm whitespace-nowrap">
            {creating ? d.cancel : `+ ${d.newBtn}`}
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{d.subtitle}</p>

      {error && <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</div>}

      {/* Création d'une dérogation autonome (niveau organisation) — MODALE, ne pousse plus le tableau. */}
      {creating && canCreate && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" role="dialog" aria-modal="true" onClick={() => setCreating(false)}>
          <div className="card p-5 space-y-2 w-full max-w-2xl mt-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold text-gray-800 dark:text-gray-100">{d.newBtn}</h2>
              <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" aria-label={d.cancel}><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{d.orgLevelHint}</p>
            {error && <div className="p-2 rounded bg-red-50 border border-red-200 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</div>}
            <div className="flex gap-2">
              {refs.length > 0 ? (
                <select value={form.referentiel} onChange={e => setForm(f => ({ ...f, referentiel: e.target.value, ref: '' }))} className="flex-1 px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm">
                  <option value="">{d.referentiel}…</option>
                  {refs.map(r => <option key={r.code} value={r.code}>{r.nom}</option>)}
                </select>
              ) : (
                <input value={form.referentiel} onChange={e => setForm(f => ({ ...f, referentiel: e.target.value }))} placeholder={d.referentiel} className="flex-1 px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
              )}
              {exigences.length > 0 ? (
                <select value={form.ref}
                  onChange={e => { const ex = exigences.find(x => x.ref === e.target.value); setForm(f => ({ ...f, ref: e.target.value, intitule: f.intitule || (ex ? `[${ex.ref}] ${ex.nom}` : f.intitule) })) }}
                  className="flex-1 px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm">
                  <option value="">{d.controle}…</option>
                  {exigences.map(ex => <option key={ex.ref} value={ex.ref}>[{ex.ref}] {ex.nom}</option>)}
                </select>
              ) : (
                <input value={form.ref} onChange={e => setForm(f => ({ ...f, ref: e.target.value }))} placeholder={d.controle} className="flex-1 px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
              )}
            </div>
            <AutocompleteInput field="mesure" lang={locale} value={form.intitule} onChange={v => setForm(f => ({ ...f, intitule: v }))}
              placeholder={d.intitulePlaceholder} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
            <textarea value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))} placeholder={d.motifPlaceholder} rows={2} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
            <textarea value={form.mesures} onChange={e => setForm(f => ({ ...f, mesures: e.target.value }))} placeholder={d.mesuresPlaceholder} rows={2} className="w-full px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <span>{d.dureeLabel}</span>
              <input type="number" min={1} max={dureeMax} value={form.dureeJours}
                onChange={e => setForm(f => ({ ...f, dureeJours: e.target.value }))}
                placeholder={String(dureeDefaut)} className="w-24 px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm" />
              <span className="text-gray-400">{d.dureeMaxHint?.replace('{max}', String(dureeMax))}</span>
            </label>
            <div className="flex gap-2 pt-1">
              <button onClick={submitCreate} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{d.submit}</button>
              <button onClick={() => setCreating(false)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200">{d.cancel}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {filtres.map(f => (
          <button key={f.key} onClick={() => setFiltre(f.key)}
            className={`text-sm px-3 py-1 rounded-full font-medium transition-colors ${filtre === f.key ? 'bg-ebios-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3">{d.intitule}</th>
              <th className="px-4 py-3">{d.colAnalyse}</th>
              <th className="px-4 py-3">{d.portee}</th>
              <th className="px-4 py-3">{d.colEtat}</th>
              <th className="px-4 py-3">{d.colEcheance}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 italic">{d.empty}</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{r.intitule}</td>
                <td className="px-4 py-3">
                  {r.analyseId
                    ? <Link href={`/analyses/${r.analyseId}`} className="text-ebios-600 dark:text-ebios-300 hover:underline">{r.analyseNom}</Link>
                    : <span className="text-gray-400 dark:text-gray-500 italic">{d.orgLevel}</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {(d.portees as Record<string, string>)[r.portee] ?? r.portee}
                  {r.referentiel && <span className="block text-xs">{r.referentiel}{r.ref && ` · ${r.ref}`}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${BADGE[r.etat]}`}>
                    {(d.statuts as Record<string, string>)[r.etat] ?? r.etat}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {r.dateFin ? (
                    <>
                      {formatDate(r.dateFin, locale)}
                      {r.etat === 'EXPIRE_BIENTOT' && <span className="block text-[11px] text-amber-600">{d.expiresIn.replace('{n}', String(r.jours))}</span>}
                      {r.etat === 'EXPIREE' && <span className="block text-[11px] text-red-600">{d.expiredSince.replace('{n}', String(-r.jours))}</span>}
                    </>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
