'use client'

// ─── Envois et revue (2ᵉ ligne) : envoyer un modèle aux métiers, suivre, revoir, préconiser ─
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { REVUE_STATUTS, type RevueStatut } from '@/lib/questionnaire'
import type { Question, ReponseRow } from './types'

type Envoi = { id: string; titre: string; campagneId: string | null; echeance: string | null; statut: 'OUVERT' | 'CLOTURE'; avancement: Record<string, number>; total: number }
type Liste = { envois: Envoi[]; modeles: { id: string; titre: string }[]; campagnes: { id: string; intitule: string }[]; repondants: { id: string; name: string | null; email: string }[] }
type Detail = { id: string; titre: string; statut: string; questions: Question[]; reponses: ReponseRow[] }

export default function QuestionnaireEnvois() {
  const { t, locale } = useTranslation()
  const q = t.questionnaires
  const [liste, setListe] = useState<Liste | null>(null)
  const [creation, setCreation] = useState(false)
  const [form, setForm] = useState({ modeleId: '', campagneId: '', echeance: '', repondantIds: [] as string[] })
  const [detail, setDetail] = useState<Detail | null>(null)
  const [revueDe, setRevueDe] = useState<string | null>(null)
  const [revues, setRevues] = useState<Record<string, { statut: RevueStatut; commentaire: string }>>({})
  const [preco, setPreco] = useState<{ reponseId: string; questionId: string; intitule: string; recommandation: string; criticite: string; echeance: string } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Lecture sans effet de bord : l'effet initial applique le résultat dans un rappel (pas de setState synchrone).
  async function lire() {
    const res = await fetch('/api/questionnaires/envois')
    return res.ok ? await res.json() : { envois: [], modeles: [], campagnes: [], repondants: [] }
  }
  async function charger() { setListe(await lire()) }
  useEffect(() => { void lire().then(setListe) }, [])

  async function ouvrir(id: string) {
    setMsg(null); setError(null); setRevueDe(null); setPreco(null)
    const res = await fetch(`/api/questionnaires/envois/${id}`)
    if (res.ok) setDetail((await res.json()).envoi)
  }

  async function envoyer() {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/questionnaires/envois', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, campagneId: form.campagneId || null, echeance: form.echeance || null }) })
      if (!res.ok) { setError(q.error); return }
      setCreation(false); setForm({ modeleId: '', campagneId: '', echeance: '', repondantIds: [] }); await charger()
    } finally { setBusy(false) }
  }

  async function statutEnvoi(statut: 'OUVERT' | 'CLOTURE') {
    if (!detail) return
    await fetch(`/api/questionnaires/envois/${detail.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statut }) })
    await ouvrir(detail.id); await charger()
  }

  function commencerRevue(r: ReponseRow) {
    setRevueDe(r.id)
    setRevues(Object.fromEntries(r.reponses.map(x => [x.questionId, { statut: x.revue?.statut ?? 'ACCEPTEE', commentaire: x.revue?.commentaire ?? '' }])))
  }

  async function enregistrerRevue() {
    if (!revueDe || !detail) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/questionnaires/reponses/${revueDe}/revue`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revues: Object.entries(revues).map(([questionId, v]) => ({ questionId, ...v })) }) })
      if (!res.ok) { setError(q.error); return }
      const { executionsAnomalie } = await res.json() as { executionsAnomalie?: number }
      setRevueDe(null); await ouvrir(detail.id); await charger()
      // Non-conformités sur des points de contrôle : exécutions « anomalie » enregistrées par le serveur.
      if (executionsAnomalie) setMsg(q.executionsCreees.replace('{n}', String(executionsAnomalie)))
    } finally { setBusy(false) }
  }

  async function creerPreco() {
    if (!preco) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/preconisations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...preco, criticite: preco.criticite || null, echeance: preco.echeance || null, campagneId: liste?.envois.find(e => e.id === detail?.id)?.campagneId ?? null }) })
      if (!res.ok) { setError(q.error); return }
      setPreco(null); setMsg(q.preconisationCreee)
    } finally { setBusy(false) }
  }

  const inp = 'mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'
  const lbl = 'block text-xs text-gray-600 dark:text-gray-300'
  const jour = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale) : q.none)
  const valeur = (v: unknown) => (v === true ? q.oui : v === false ? q.non : v === null || v === undefined || v === '' ? q.none : String(v))

  if (detail) return <section className="space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-semibold text-gray-900 dark:text-gray-100">{detail.titre}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">{q.envoiStatuts[detail.statut as 'OUVERT' | 'CLOTURE']}</p></div>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary text-sm" onClick={() => void statutEnvoi(detail.statut === 'OUVERT' ? 'CLOTURE' : 'OUVERT')}>{detail.statut === 'OUVERT' ? q.cloturer : q.rouvrir}</button>
        <button type="button" className="btn-secondary text-sm" onClick={() => setDetail(null)}>{q.close}</button>
      </div>
    </div>
    {msg && <p role="status" className="text-sm text-green-800 dark:text-green-300">{msg}</p>}
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    {detail.reponses.map(r => <div key={r.id} className="card space-y-2 p-3" data-reponse={r.id}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{q.reponsesDe.replace('{nom}', r.repondant ?? q.none)} · <span className="font-normal text-gray-600 dark:text-gray-300">{q.statuts[r.statut]}</span></p>
        {r.statut === 'SOUMISE' && revueDe !== r.id && <button type="button" className="btn-primary text-xs" onClick={() => commencerRevue(r)}>{q.reviser}</button>}
      </div>
      {detail.questions.map(qu => {
        const rep = r.reponses.find(x => x.questionId === qu.id)
        if (!rep) return null
        return <div key={qu.id} className="rounded border border-gray-100 p-2 text-sm dark:border-gray-800">
          <p className="text-gray-800 dark:text-gray-100">{qu.libelle}</p>
          <p className="text-gray-700 dark:text-gray-200"><strong>{valeur(rep.valeur)}</strong>{rep.commentaire ? ` — ${rep.commentaire}` : ''}</p>
          {rep.preuves.length > 0 && <p className="text-xs">{rep.preuves.map((p, k) => <a key={k} className="mr-3 text-ebios-700 underline dark:text-ebios-300" href={p.dataUrl} download={p.nom}>📎 {p.nom}</a>)}</p>}
          {revueDe === r.id ? <div className="mt-1 grid gap-2 sm:grid-cols-[12rem_1fr]">
            <select aria-label={`${q.reviser} — ${qu.libelle}`} className={inp} value={revues[qu.id]?.statut ?? 'ACCEPTEE'} onChange={e => setRevues(v => ({ ...v, [qu.id]: { ...v[qu.id], statut: e.target.value as RevueStatut } }))}>
              {REVUE_STATUTS.map(s => <option key={s} value={s}>{q.revueStatuts[s]}</option>)}</select>
            <input aria-label={q.commentaire} placeholder={q.commentaire} className={inp} value={revues[qu.id]?.commentaire ?? ''} onChange={e => setRevues(v => ({ ...v, [qu.id]: { ...v[qu.id], commentaire: e.target.value } }))} />
          </div> : rep.revue && <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{q.revueDu} : <strong>{q.revueStatuts[rep.revue.statut]}</strong>{rep.revue.commentaire ? ` — ${rep.revue.commentaire}` : ''}
            {rep.revue.statut === 'NON_CONFORME' && <button type="button" className="ml-2 underline" onClick={() => setPreco({ reponseId: r.id, questionId: qu.id, intitule: qu.libelle.slice(0, 200), recommandation: rep.revue?.commentaire ?? '', criticite: '', echeance: '' })}>{q.creerPreco}</button>}</p>}
          {preco?.reponseId === r.id && preco.questionId === qu.id && <div className="mt-2 space-y-2 rounded border border-amber-200 p-2 dark:border-amber-500/30">
            <label className={lbl}>{q.intitule}<input className={inp} value={preco.intitule} onChange={e => setPreco({ ...preco, intitule: e.target.value })} /></label>
            <label className={lbl}>{q.recommandation}<textarea className={inp} rows={2} value={preco.recommandation} onChange={e => setPreco({ ...preco, recommandation: e.target.value })} /></label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={lbl}>{q.criticite}<select className={inp} value={preco.criticite} onChange={e => setPreco({ ...preco, criticite: e.target.value })}><option value="">{q.none}</option>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
              <label className={lbl}>{q.echeance}<input type="date" className={inp} value={preco.echeance} onChange={e => setPreco({ ...preco, echeance: e.target.value })} /></label>
            </div>
            <div className="flex gap-2"><button type="button" className="btn-primary text-xs" disabled={busy || !preco.intitule.trim()} onClick={() => void creerPreco()}>{q.creer}</button>
              <button type="button" className="btn-secondary text-xs" onClick={() => setPreco(null)}>{q.cancel}</button></div>
          </div>}
        </div>
      })}
      {revueDe === r.id && <div className="flex gap-2"><button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void enregistrerRevue()}>{q.enregistrerRevue}</button>
        <button type="button" className="btn-secondary text-sm" onClick={() => setRevueDe(null)}>{q.cancel}</button></div>}
    </div>)}
  </section>

  return <section className="space-y-3">
    {!creation && <button type="button" className="btn-primary text-sm" onClick={() => setCreation(true)}>{q.nouvelEnvoi}</button>}
    {creation && liste && <div className="card space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={lbl}>{q.modele}<select className={inp} value={form.modeleId} onChange={e => setForm({ ...form, modeleId: e.target.value })}>
          <option value="">{q.none}</option>{liste.modeles.map(m => <option key={m.id} value={m.id}>{m.titre}</option>)}</select></label>
        <label className={lbl}>{q.mission}<select className={inp} value={form.campagneId} onChange={e => setForm({ ...form, campagneId: e.target.value })}>
          <option value="">{q.aucuneMission}</option>{liste.campagnes.map(c => <option key={c.id} value={c.id}>{c.intitule}</option>)}</select></label>
        <label className={lbl}>{q.echeance}<input type="date" className={inp} value={form.echeance} onChange={e => setForm({ ...form, echeance: e.target.value })} /></label>
      </div>
      <fieldset><legend className={lbl}>{q.repondants} ({form.repondantIds.length})</legend>
        <div className="mt-1 max-h-48 overflow-y-auto rounded border border-gray-200 p-2 dark:border-gray-700">
          {liste.repondants.map(u => <label key={u.id} className="flex gap-2 py-0.5 text-sm"><input type="checkbox" checked={form.repondantIds.includes(u.id)}
            onChange={() => setForm(f => ({ ...f, repondantIds: f.repondantIds.includes(u.id) ? f.repondantIds.filter(x => x !== u.id) : [...f.repondantIds, u.id] }))} />{u.name ?? u.email}</label>)}
        </div></fieldset>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex gap-2"><button type="button" className="btn-primary text-sm" disabled={busy || !form.modeleId || !form.repondantIds.length} onClick={() => void envoyer()}>{q.envoyer}</button>
        <button type="button" className="btn-secondary text-sm" onClick={() => setCreation(false)}>{q.cancel}</button></div>
    </div>}
    {liste === null ? <p className="text-sm text-gray-500">{q.loading}</p>
      : liste.envois.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">{q.envoisVide}</p>
      : liste.envois.map(e => {
        const soumises = (e.avancement.SOUMISE ?? 0) + (e.avancement.REVUE ?? 0) + (e.avancement.A_COMPLETER ?? 0)
        return <div key={e.id} className="card flex items-center justify-between gap-3 p-3">
          <div className="min-w-0"><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{e.titre} <span className="text-xs font-normal text-gray-500">({q.envoiStatuts[e.statut]})</span></p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{q.avancement.replace('{soumises}', String(soumises)).replace('{revues}', String(e.avancement.REVUE ?? 0)).replace('{total}', String(e.total))} · {q.echeance} : {jour(e.echeance)}</p></div>
          <button type="button" className="btn-secondary text-sm" onClick={() => void ouvrir(e.id)}>{q.ouvrir}</button>
        </div>
      })}
  </section>
}
