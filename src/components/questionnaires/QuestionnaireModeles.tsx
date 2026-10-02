'use client'

// ─── Modèles de questionnaire (2ᵉ ligne) : questionnaire libre ou exigences à justifier ─
// Chaque question peut viser un point de contrôle, une exigence, un risque ou un processus.
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { CIBLE_TYPES, QUESTION_TYPES, type CibleType, type QuestionType } from '@/lib/questionnaire'
import type { Question } from './types'

type Modele = { id: string; titre: string; description: string | null; mode: 'QUESTIONNAIRE' | 'EXIGENCES'; referentielCode: string | null; questions: Question[]; actif: boolean }
type Option = { id: string; label: string }
type QForm = { libelle: string; type: QuestionType; choix: string; obligatoire: boolean; preuveRequise: boolean; cibleType: '' | CibleType; cibleId: string; cibleRef: string; cibleCode: string }
const VIDE: QForm = { libelle: '', type: 'OUI_NON', choix: '', obligatoire: true, preuveRequise: false, cibleType: '', cibleId: '', cibleRef: '', cibleCode: '' }

export default function QuestionnaireModeles({ conformiteActive }: { conformiteActive: boolean }) {
  const { t } = useTranslation()
  const q = t.questionnaires
  const [modeles, setModeles] = useState<Modele[] | null>(null)
  const [creation, setCreation] = useState(false)
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<'QUESTIONNAIRE' | 'EXIGENCES'>('QUESTIONNAIRE')
  const [questions, setQuestions] = useState<QForm[]>([{ ...VIDE }])
  const [refCode, setRefCode] = useState('')
  const [exigenceRefs, setExigenceRefs] = useState<string[]>([])
  const [referentiels, setReferentiels] = useState<{ code: string; nom: string }[]>([])
  const [exigences, setExigences] = useState<Record<string, { ref: string; nom: string }[]>>({})
  const [options, setOptions] = useState<Record<'CONTROLE' | 'RISQUE' | 'PROCESSUS', Option[]>>({ CONTROLE: [], RISQUE: [], PROCESSUS: [] })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Lecture sans effet de bord : l'effet initial applique le résultat dans un rappel (pas de setState synchrone).
  async function lire() {
    const res = await fetch('/api/questionnaires/modeles')
    return res.ok ? (await res.json()).modeles : []
  }
  async function charger() { setModeles(await lire()) }
  useEffect(() => { void lire().then(setModeles) }, [])

  // Données de rattachement chargées à l'ouverture de l'éditeur.
  useEffect(() => {
    if (!creation) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Any = any
    const j = (u: string): Promise<Any> => fetch(u).then(r => (r.ok ? r.json() : {})).catch(() => ({}))
    void Promise.all([j('/api/controles'), j('/api/risk-items'), j('/api/processus'), conformiteActive ? j('/api/referentiels') : Promise.resolve({})]).then(([c, r, p, ref]: Any[]) => {
      setOptions({
        CONTROLE: (c.controles ?? []).map((x: { id: string; intitule: string }) => ({ id: x.id, label: x.intitule })),
        RISQUE: (r.risks ?? r.riskItems ?? []).map((x: { id: string; intitule: string }) => ({ id: x.id, label: x.intitule })),
        PROCESSUS: (p.processus ?? []).map((x: { id: string; nom: string }) => ({ id: x.id, label: x.nom })),
      })
      setReferentiels((ref.referentiels ?? []).filter((x: { actif?: boolean }) => x.actif !== false).map((x: { code: string; nom: string }) => ({ code: x.code, nom: x.nom })))
    })
  }, [creation, conformiteActive])

  async function exigencesDe(code: string) {
    if (!code || exigences[code]) return
    const res = await fetch(`/api/referentiels/exigences?code=${encodeURIComponent(code)}`)
    const d = res.ok ? await res.json() : { exigences: [] }
    setExigences(e => ({ ...e, [code]: d.exigences ?? [] }))
  }

  const maj = (i: number, patch: Partial<QForm>) => setQuestions(qs => qs.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  async function creer() {
    setBusy(true); setError(null)
    const payload = mode === 'EXIGENCES'
      ? { titre, description, mode, referentielCode: refCode, exigenceRefs }
      : { titre, description, mode, questions: questions.map(x => ({
          libelle: x.libelle, type: x.type, obligatoire: x.obligatoire, preuveRequise: x.preuveRequise,
          ...(x.type === 'CHOIX' ? { choix: x.choix.split('\n').map(s => s.trim()).filter(Boolean) } : {}),
          ...(x.cibleType === 'EXIGENCE' ? { cible: { type: 'EXIGENCE', referentielCode: x.cibleCode, ref: x.cibleRef } } : x.cibleType ? { cible: { type: x.cibleType, id: x.cibleId } } : {}),
        })) }
    try {
      const res = await fetch('/api/questionnaires/modeles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { setError(q.error); return }
      setCreation(false); setTitre(''); setDescription(''); setQuestions([{ ...VIDE }]); setExigenceRefs([]); await charger()
    } finally { setBusy(false) }
  }

  async function basculer(m: Modele) {
    await fetch(`/api/questionnaires/modeles/${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actif: !m.actif }) })
    await charger()
  }

  const inp = 'mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'
  const lbl = 'block text-xs text-gray-600 dark:text-gray-300'

  return <section className="space-y-3">
    {!creation && <button type="button" className="btn-primary text-sm" onClick={() => setCreation(true)}>{q.nouveauModele}</button>}
    {creation && <div className="card space-y-3 p-4">
      <label className={lbl}>{q.titreModele}<input className={inp} value={titre} onChange={e => setTitre(e.target.value)} /></label>
      <label className={lbl}>{q.description}<textarea className={inp} rows={2} value={description} onChange={e => setDescription(e.target.value)} /></label>
      <div className="flex flex-wrap gap-4 text-sm">
        {(conformiteActive ? (['QUESTIONNAIRE', 'EXIGENCES'] as const) : (['QUESTIONNAIRE'] as const)).map(m => (
          <label key={m} className="inline-flex items-center gap-1.5"><input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />{q.modes[m]}</label>
        ))}
      </div>
      {mode === 'EXIGENCES' ? <div className="space-y-2">
        <label className={lbl}>{q.referentiel}
          <select className={inp} value={refCode} onChange={e => { setRefCode(e.target.value); setExigenceRefs([]); void exigencesDe(e.target.value) }}>
            <option value="">{q.none}</option>{referentiels.map(r => <option key={r.code} value={r.code}>{r.nom}</option>)}
          </select></label>
        {refCode && <fieldset><legend className={lbl}>{q.exigences} ({exigenceRefs.length})</legend>
          <div className="mt-1 max-h-64 overflow-y-auto rounded border border-gray-200 p-2 dark:border-gray-700">
            {(exigences[refCode] ?? []).map(e => <label key={e.ref} className="flex gap-2 py-0.5 text-sm"><input type="checkbox" checked={exigenceRefs.includes(e.ref)}
              onChange={() => setExigenceRefs(rs => (rs.includes(e.ref) ? rs.filter(x => x !== e.ref) : [...rs, e.ref]))} /><span><span className="text-gray-500">{e.ref}</span> {e.nom}</span></label>)}
          </div></fieldset>}
      </div> : <div className="space-y-3">
        {questions.map((x, i) => <div key={i} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700 space-y-2">
          <label className={lbl}>{q.libelle} {i + 1}<input className={inp} value={x.libelle} onChange={e => maj(i, { libelle: e.target.value })} /></label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={lbl}>{q.type}<select className={inp} value={x.type} onChange={e => maj(i, { type: e.target.value as QuestionType })}>
              {QUESTION_TYPES.map(ty => <option key={ty} value={ty}>{q.types[ty]}</option>)}</select></label>
            <label className={lbl}>{q.cible}<select className={inp} value={x.cibleType} onChange={e => maj(i, { cibleType: e.target.value as QForm['cibleType'], cibleId: '', cibleRef: '' })}>
              <option value="">{q.cibles.aucune}</option>{CIBLE_TYPES.filter(c => c !== 'EXIGENCE' || conformiteActive).map(c => <option key={c} value={c}>{q.cibles[c]}</option>)}</select></label>
          </div>
          {x.type === 'CHOIX' && <label className={lbl}>{q.choix}<textarea className={inp} rows={3} value={x.choix} onChange={e => maj(i, { choix: e.target.value })} /></label>}
          {(x.cibleType === 'CONTROLE' || x.cibleType === 'RISQUE' || x.cibleType === 'PROCESSUS') && <select aria-label={q.cibles[x.cibleType]} className={inp} value={x.cibleId} onChange={e => maj(i, { cibleId: e.target.value })}>
            <option value="">{q.none}</option>{options[x.cibleType].map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select>}
          {x.cibleType === 'EXIGENCE' && <div className="grid gap-2 sm:grid-cols-2">
            <select aria-label={q.referentiel} className={inp} value={x.cibleCode} onChange={e => { maj(i, { cibleCode: e.target.value, cibleRef: '' }); void exigencesDe(e.target.value) }}>
              <option value="">{q.referentiel}</option>{referentiels.map(r => <option key={r.code} value={r.code}>{r.nom}</option>)}</select>
            <select aria-label={q.cibles.EXIGENCE} className={inp} value={x.cibleRef} onChange={e => maj(i, { cibleRef: e.target.value })}>
              <option value="">{q.cibles.EXIGENCE}</option>{(exigences[x.cibleCode] ?? []).map(e => <option key={e.ref} value={e.ref}>{e.ref} {e.nom}</option>)}</select>
          </div>}
          <div className="flex flex-wrap gap-4 text-xs text-gray-700 dark:text-gray-200">
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={x.obligatoire} onChange={e => maj(i, { obligatoire: e.target.checked })} />{q.obligatoire}</label>
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={x.preuveRequise} onChange={e => maj(i, { preuveRequise: e.target.checked })} />{q.preuveRequise}</label>
            {questions.length > 1 && <button type="button" className="text-red-600 underline" onClick={() => setQuestions(qs => qs.filter((_, j) => j !== i))}>{q.retirer}</button>}
          </div>
        </div>)}
        <button type="button" className="btn-secondary text-sm" onClick={() => setQuestions(qs => [...qs, { ...VIDE }])}>{q.ajouterQuestion}</button>
      </div>}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-primary text-sm" disabled={busy || !titre.trim()} onClick={() => void creer()}>{q.creer}</button>
        <button type="button" className="btn-secondary text-sm" onClick={() => setCreation(false)}>{q.cancel}</button>
      </div>
    </div>}
    {modeles === null ? <p className="text-sm text-gray-500">{q.loading}</p>
      : modeles.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">{q.modelesVide}</p>
      : modeles.map(m => <div key={m.id} className="card flex items-center justify-between gap-3 p-3">
        <div className="min-w-0"><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{m.titre}{!m.actif && <span className="ml-2 text-xs text-gray-500">({q.inactif})</span>}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{q.modes[m.mode]} · {q.nbQuestions.replace('{n}', String(m.questions.length))}</p></div>
        <button type="button" className="btn-secondary text-xs" onClick={() => void basculer(m)}>{m.actif ? q.desactiver : q.activer}</button>
      </div>)}
  </section>
}
