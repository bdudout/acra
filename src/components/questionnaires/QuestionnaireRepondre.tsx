'use client'

// ─── Réponse du métier : liste des questionnaires adressés, saisie, preuves, soumission ─
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { MAX_PREUVES_PAR_QUESTION } from '@/lib/questionnaire'
import { lirePreuves, type Question, type Reponse, type ReponseRow } from './types'

type MaReponse = { id: string; statut: ReponseRow['statut']; soumiseLe: string | null; envoi: { titre: string; echeance: string | null; statut: string } }
type Detail = { reponse: ReponseRow; envoi: { id: string; titre: string; questions: Question[]; echeance: string | null; statut: string }; estRepondant: boolean }

export default function QuestionnaireRepondre() {
  const { t, locale } = useTranslation()
  const q = t.questionnaires
  const [liste, setListe] = useState<MaReponse[] | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [reponses, setReponses] = useState<Reponse[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Lecture sans effet de bord : l'effet initial applique le résultat dans un rappel (pas de setState synchrone).
  async function lire() {
    const res = await fetch('/api/questionnaires/mes-reponses')
    return res.ok ? (await res.json()).reponses : []
  }
  async function charger() { setListe(await lire()) }
  useEffect(() => { void lire().then(setListe) }, [])

  async function ouvrir(id: string) {
    setMsg(null); setError(null)
    const res = await fetch(`/api/questionnaires/reponses/${id}`)
    if (!res.ok) { setError(q.error); return }
    const d = await res.json() as Detail
    setDetail(d); setReponses(d.reponse.reponses ?? [])
  }

  const editable = !!detail && detail.estRepondant && (detail.reponse.statut === 'A_REPONDRE' || detail.reponse.statut === 'A_COMPLETER') && detail.envoi.statut === 'OUVERT'
  const get = (id: string) => reponses.find(r => r.questionId === id)
  const set = (id: string, patch: Partial<Reponse>) => setReponses(rs => {
    const prev = rs.find(r => r.questionId === id) ?? { questionId: id, valeur: null, preuves: [] }
    return [...rs.filter(r => r.questionId !== id), { ...prev, ...patch }]
  })

  async function enregistrer(): Promise<boolean> {
    if (!detail) return false
    setBusy(true); setError(null); setMsg(null)
    try {
      const res = await fetch(`/api/questionnaires/reponses/${detail.reponse.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reponses }) })
      if (!res.ok) { setError(res.status === 409 ? q.figee : q.error); return false }
      setReponses((await res.json()).reponses); setMsg(q.enregistre); return true
    } finally { setBusy(false) }
  }

  async function soumettre() {
    if (!detail || !(await enregistrer())) return
    setBusy(true)
    try {
      const res = await fetch(`/api/questionnaires/reponses/${detail.reponse.id}/soumettre`, { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (res.status === 400 && d.error === 'reponse_incomplete') { setError(q.incomplet.replace('{n}', String(d.questions?.length ?? 0))); return }
      if (!res.ok) { setError(q.error); return }
      setMsg(q.soumis); await charger(); await ouvrir(detail.reponse.id)
    } finally { setBusy(false) }
  }

  const jour = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale) : q.none)
  const inp = 'mt-1 w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'

  if (detail) return <section className="card p-4 space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div><h2 className="font-semibold text-gray-900 dark:text-gray-100">{detail.envoi.titre}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">{q.statut} : {q.statuts[detail.reponse.statut]} · {q.echeance} : {jour(detail.envoi.echeance)}</p></div>
      <button type="button" className="btn-secondary text-sm" onClick={() => { setDetail(null); void charger() }}>{q.close}</button>
    </div>
    {!editable && <p className="text-sm text-gray-600 dark:text-gray-300">{q.figee}</p>}
    {detail.envoi.questions.map((qu, i) => {
      const r = get(qu.id)
      return <div key={qu.id} data-question={qu.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{i + 1}. {qu.libelle}
          <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">{[qu.obligatoire && q.obligatoire, qu.preuveRequise && q.preuveRequise].filter(Boolean).join(' · ')}</span></p>
        {qu.type === 'OUI_NON' && <div className="mt-2 flex gap-4 text-sm">
          {[true, false].map(v => <label key={String(v)} className="inline-flex items-center gap-1.5"><input type="radio" name={`q-${qu.id}`} disabled={!editable} checked={r?.valeur === v} onChange={() => set(qu.id, { valeur: v })} />{v ? q.oui : q.non}</label>)}
        </div>}
        {qu.type === 'CHOIX' && <select aria-label={qu.libelle} className={inp} disabled={!editable} value={typeof r?.valeur === 'string' ? r.valeur : ''} onChange={e => set(qu.id, { valeur: e.target.value || null })}>
          <option value="">{q.none}</option>{qu.choix?.map(c => <option key={c} value={c}>{c}</option>)}</select>}
        {qu.type === 'TEXTE' && <textarea aria-label={qu.libelle} className={inp} rows={3} disabled={!editable} value={typeof r?.valeur === 'string' ? r.valeur : ''} onChange={e => set(qu.id, { valeur: e.target.value })} />}
        {qu.type === 'NOMBRE' && <input aria-label={qu.libelle} type="number" className={inp} disabled={!editable} value={typeof r?.valeur === 'number' ? r.valeur : ''} onChange={e => set(qu.id, { valeur: e.target.value === '' ? null : Number(e.target.value) })} />}
        {qu.type === 'DATE' && <input aria-label={qu.libelle} type="date" className={inp} disabled={!editable} value={typeof r?.valeur === 'string' ? r.valeur : ''} onChange={e => set(qu.id, { valeur: e.target.value || null })} />}
        <label className="mt-2 block text-xs text-gray-600 dark:text-gray-300">{q.commentaire}
          <textarea className={inp} rows={2} disabled={!editable} value={r?.commentaire ?? ''} onChange={e => set(qu.id, { commentaire: e.target.value })} /></label>
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">{q.preuves} :
          {(r?.preuves ?? []).map((p, k) => <span key={k} className="ml-2 inline-flex items-center gap-1 rounded-sm bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">📎 {p.nom}
            {editable && <button type="button" aria-label={`${q.retirer} ${p.nom}`} onClick={() => set(qu.id, { preuves: (r?.preuves ?? []).filter((_, j) => j !== k) })}>×</button>}</span>)}
          {editable && (r?.preuves.length ?? 0) < MAX_PREUVES_PAR_QUESTION && <label className="ml-2 cursor-pointer text-ebios-700 underline dark:text-ebios-300">{q.ajouterPreuve}
            <input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.txt,.csv" multiple onChange={async e => { const lues = await lirePreuves(e.target.files, MAX_PREUVES_PAR_QUESTION); set(qu.id, { preuves: [...(r?.preuves ?? []), ...lues].slice(0, MAX_PREUVES_PAR_QUESTION) }); e.target.value = '' }} /></label>}
        </div>
        {r?.revue && <p className={`mt-2 rounded-sm px-2 py-1 text-xs ${r.revue.statut === 'ACCEPTEE' ? 'bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200'}`}>
          {q.revueDu} : {q.revueStatuts[r.revue.statut]}{r.revue.commentaire ? ` — ${r.revue.commentaire}` : ''}</p>}
      </div>
    })}
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    {msg && <p role="status" className="text-sm text-green-800 dark:text-green-300">{msg}</p>}
    {editable && <div className="flex gap-2">
      <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => void enregistrer()}>{q.enregistrer}</button>
      <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void soumettre()}>{q.soumettre}</button>
    </div>}
  </section>

  return <section className="space-y-2">
    {liste === null ? <p className="text-sm text-gray-500">{q.loading}</p>
      : liste.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">{q.mesVide}</p>
      : liste.map(r => <div key={r.id} className="card flex items-center justify-between gap-3 p-3">
        <div className="min-w-0"><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.envoi.titre}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{q.statuts[r.statut]} · {q.echeance} : {jour(r.envoi.echeance)}</p></div>
        <button type="button" className="btn-secondary text-sm" onClick={() => void ouvrir(r.id)}>{q.ouvrir}</button>
      </div>)}
  </section>
}
