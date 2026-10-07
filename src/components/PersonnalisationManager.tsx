'use client'

// ─── Personnalisation (ADMIN de l'organisation) ──────────────────────────────
// Vocabulaire (renommage à l'affichage), champs personnalisés par module et gabarits sectoriels.
// Le vocabulaire et les champs s'enregistrent ensemble ; un gabarit s'applique après aperçu.

import { useEffect, useState } from 'react'
import { Wand2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { VOCAB_TERMS, VOCAB_LOCALES, type Vocabulaire, type VocabTerm } from '@/lib/vocabulaire'
import { CHAMPS_MODULES, CHAMP_TYPES, ROLES_CHAMP, MAX_CHAMPS_PAR_MODULE, type ChampDef, type ChampsConfig, type ChampsModule } from '@/lib/champs-perso'
import { GABARITS } from '@/lib/gabarits'

interface Changement { type: string; cle: string; avant: boolean | string | null; apres: boolean | string | null }
const inp = 'px-2 py-1.5 rounded-sm border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'champ'

export default function PersonnalisationManager() {
  const { t, reloadVocabulaire } = useTranslation()
  const p = t.personnalisation
  const [loaded, setLoaded] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [vocab, setVocab] = useState<Vocabulaire>({})
  const [champs, setChamps] = useState<ChampsConfig>({})
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [gabarit, setGabarit] = useState('')
  const [apercu, setApercu] = useState<Changement[] | null>(null)
  const termLabels = p.vocabulaire.terms as Record<string, string>

  function charger() {
    fetch('/api/personnalisation').then(r => (r.ok ? r.json() : null)).then(d => {
      if (d) { setVocab(d.vocabulaire ?? {}); setChamps(d.champs ?? {}); setCanEdit(!!d.canEdit) }
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }
  useEffect(charger, [])

  const setLabel = (term: VocabTerm, lang: string, v: string) => setVocab(cur => {
    const labels = { ...(cur[term] ?? {}) }
    if (v) labels[lang] = v; else delete labels[lang]
    const next = { ...cur }
    if (Object.keys(labels).length) next[term] = labels; else delete next[term]
    return next
  })
  const setChamp = (mod: ChampsModule, i: number, patch: Partial<ChampDef>) => setChamps(cur => ({ ...cur, [mod]: (cur[mod] ?? []).map((d, k) => (k === i ? { ...d, ...patch } : d)) }))
  const addChamp = (mod: ChampsModule) => setChamps(cur => {
    const defs = cur[mod] ?? []
    if (defs.length >= MAX_CHAMPS_PAR_MODULE) return cur
    let code = 'champ'; let n = 1
    while (defs.some(d => d.code === code)) code = `champ_${++n}`
    return { ...cur, [mod]: [...defs, { code, label: '', type: 'TEXTE' }] }
  })
  const removeChamp = (mod: ChampsModule, i: number) => setChamps(cur => ({ ...cur, [mod]: (cur[mod] ?? []).filter((_, k) => k !== i) }))

  async function enregistrer() {
    setBusy(true); setMsg(null)
    // Le code d'un champ nouvellement libellé est dérivé de son libellé (stable ensuite : il porte les valeurs).
    const champsPersonnalises = Object.fromEntries(CHAMPS_MODULES.map(m => [m, (champs[m] ?? []).filter(d => d.label.trim()).map(d => (/^champ(_\d+)?$/.test(d.code) ? { ...d, code: slug(d.label) } : d))]))
    const res = await fetch('/api/personnalisation', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vocabulaire: vocab, champsPersonnalises }) }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    setBusy(false)
    if (!res || !res.ok) { setMsg(p.error.replace('{error}', String(d?.error ?? res?.status ?? '—'))); return }
    setMsg(p.saved); reloadVocabulaire(); charger()
  }
  async function gabaritAction(dryRun: boolean) {
    if (!gabarit) return
    setBusy(true); setMsg(null)
    const res = await fetch('/api/personnalisation/gabarit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: gabarit, dryRun }) }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    setBusy(false)
    if (!res || !res.ok) { setMsg((p.errors as Record<string, string>)[d?.error] ?? p.error.replace('{error}', String(d?.error ?? res?.status ?? '—'))); return }
    if (dryRun) setApercu(d.changements ?? [])
    else { setApercu(null); setMsg(p.saved); reloadVocabulaire(); charger() }
  }
  const libelleChangement = (c: Changement): string => {
    if (c.type === 'MODULE') return `${(p.gabarits.modules as Record<string, string>)[c.cle] ?? c.cle} : ${c.apres ? p.gabarits.on : p.gabarits.off}`
    if (c.type === 'REGIME') return `${c.cle} : ${c.apres ? p.gabarits.on : p.gabarits.off}`
    if (c.type === 'SECTEUR') return `${p.gabarits.secteur} : ${(t.sectorSuggestions.sectors as Record<string, string>)[c.cle] ?? c.cle}`
    return `${c.cle} → ${String(c.apres)}`
  }

  if (!loaded) return <p className="text-sm text-gray-400">…</p>
  if (!canEdit) return <p className="text-sm text-gray-500">{p.subtitle}</p>

  return (
    <div className="space-y-8">
      <header><h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100"><Wand2 size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" />{p.title}</h1><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{p.subtitle}</p></header>

      <section className="card p-4 space-y-3" aria-label={p.gabarits.title}>
        <div><h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{p.gabarits.title}</h2><p className="text-xs text-gray-500">{p.gabarits.hint}</p></div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-500">{p.gabarits.choisir}
            <select aria-label={p.gabarits.choisir} value={gabarit} onChange={e => { setGabarit(e.target.value); setApercu(null) }} className={`${inp} block mt-1 w-72`}>
              <option value="">—</option>
              {GABARITS.map(g => <option key={g.id} value={g.id}>{(p.gabarits.items as Record<string, { nom: string }>)[g.id]?.nom ?? g.id}</option>)}
            </select>
          </label>
          <button type="button" disabled={!gabarit || busy} onClick={() => gabaritAction(true)} className="btn-secondary text-sm disabled:opacity-50">{p.gabarits.apercu}</button>
          {apercu && apercu.length > 0 && <button type="button" disabled={busy} onClick={() => gabaritAction(false)} className="btn-primary text-sm disabled:opacity-50">{p.gabarits.appliquer}</button>}
        </div>
        {gabarit && <p className="text-xs text-gray-500">{(p.gabarits.items as Record<string, { desc: string }>)[gabarit]?.desc}</p>}
        {apercu && (apercu.length === 0 ? <p className="text-xs italic text-gray-500">{p.gabarits.aucunChangement}</p> : (
          <ul aria-label={p.gabarits.changements} className="list-disc pl-5 text-xs text-gray-700 dark:text-gray-200">{apercu.map((c, i) => <li key={i}>{libelleChangement(c)}</li>)}</ul>
        ))}
      </section>

      <section className="card p-4 space-y-3" aria-label={p.vocabulaire.title}>
        <div><h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{p.vocabulaire.title}</h2><p className="text-xs text-gray-500">{p.vocabulaire.hint}</p></div>
        {(Object.keys(VOCAB_TERMS) as VocabTerm[]).map(term => (
          <details key={term} className="border-t border-gray-100 pt-2 dark:border-gray-700">
            <summary className="cursor-pointer text-sm text-gray-700 dark:text-gray-200">{termLabels[term]}</summary>
            <div className="mt-2 flex flex-wrap gap-3">
              <label className="text-xs text-gray-500">{p.vocabulaire.general}
                <input aria-label={`${termLabels[term]} — ${p.vocabulaire.general}`} value={vocab[term]?.['*'] ?? ''} maxLength={60} onChange={e => setLabel(term, '*', e.target.value)} className={`${inp} block mt-1 w-64`} />
              </label>
              {VOCAB_LOCALES.map(l => (
                <label key={l} className="text-xs text-gray-500">{l.toUpperCase()}
                  <input aria-label={`${termLabels[term]} — ${l.toUpperCase()}`} value={vocab[term]?.[l] ?? ''} maxLength={60} onChange={e => setLabel(term, l, e.target.value)} className={`${inp} block mt-1 w-40`} />
                </label>
              ))}
            </div>
          </details>
        ))}
      </section>

      <section className="card p-4 space-y-4" aria-label={p.champs.title}>
        <div><h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{p.champs.title}</h2><p className="text-xs text-gray-500">{p.champs.hint.replace('{n}', String(MAX_CHAMPS_PAR_MODULE))}</p></div>
        {CHAMPS_MODULES.map(mod => {
          const modName = (p.champs.modules as Record<string, string>)[mod]
          const defs = champs[mod] ?? []
          return (
            <div key={mod} className="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700">
              <h3 className="text-xs font-semibold uppercase text-gray-500">{modName}</h3>
              {defs.length === 0 && <p className="text-xs italic text-gray-400">{p.champs.vide}</p>}
              {defs.map((d, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-2 dark:bg-gray-800/40">
                  <label className="text-xs text-gray-500">{p.champs.label}<input aria-label={p.champs.label} value={d.label} maxLength={80} onChange={e => setChamp(mod, i, { label: e.target.value })} className={`${inp} block mt-1 w-56`} /></label>
                  <label className="text-xs text-gray-500">{p.champs.type}
                    <select aria-label={p.champs.type} value={d.type} onChange={e => setChamp(mod, i, { type: e.target.value as ChampDef['type'] })} className={`${inp} block mt-1`}>{CHAMP_TYPES.map(x => <option key={x} value={x}>{(p.champs.types as Record<string, string>)[x]}</option>)}</select>
                  </label>
                  {d.type === 'LISTE' && <label className="text-xs text-gray-500">{p.champs.options}<input aria-label={p.champs.options} value={(d.options ?? []).join(', ')} onChange={e => setChamp(mod, i, { options: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} className={`${inp} block mt-1 w-56`} /></label>}
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300"><input type="checkbox" aria-label={p.champs.requis} checked={!!d.requis} onChange={e => setChamp(mod, i, { requis: e.target.checked })} />{p.champs.requis}</label>
                  <label className="text-xs text-gray-500">{p.champs.roles}
                    <select multiple aria-label={p.champs.roles} value={d.roles ?? []} onChange={e => setChamp(mod, i, { roles: [...e.target.selectedOptions].map(o => o.value) })} className={`${inp} block mt-1 h-16`}>{ROLES_CHAMP.map(r => <option key={r} value={r}>{r}</option>)}</select>
                  </label>
                  <button type="button" onClick={() => removeChamp(mod, i)} className="text-xs text-red-600 hover:underline">{p.champs.remove}</button>
                </div>
              ))}
              {defs.length < MAX_CHAMPS_PAR_MODULE && <button type="button" aria-label={`${p.champs.add} — ${modName}`} onClick={() => addChamp(mod)} className="text-xs text-ebios-700 hover:underline">{p.champs.add}</button>}
            </div>
          )
        })}
      </section>

      <div className="flex items-center gap-3">
        <button type="button" disabled={busy} onClick={enregistrer} className="btn-primary text-sm disabled:opacity-50">{p.save}</button>
        {msg && <span role="status" className="text-xs text-gray-600 dark:text-gray-300">{msg}</span>}
      </div>
    </div>
  )
}
