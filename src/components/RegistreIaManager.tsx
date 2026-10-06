'use client'
// ─── Registre des algorithmes et systèmes d'IA ────────────────────────────────
// Liste des systèmes de l'organisation (classement indicatif au regard du règlement (UE) 2024/1689, revue en retard,
// champs à compléter), synthèse, ajout / modification / suppression, et import de systèmes types du catalogue
// (sélection ligne par ligne : un système déjà importé n'est pas sélectionnable). API : /api/registre-ia.

import { useCallback, useEffect, useState } from 'react'
import { BrainCircuit } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { DECISIONS_IA, STATUTS_IA, USAGES_IA } from '@/lib/registre-ia'

type Classe = 'HAUT_RISQUE_PROBABLE' | 'RISQUE_LIMITE' | 'A_QUALIFIER'
interface Systeme {
  id: string; nom: string; finalite: string; fournisseur: string | null; donnees: string[]; categoriesParticulieres: boolean
  typeDecision: string; interventionHumaine: string | null; usage: string; controlesBiais: string | null
  derniereRevue: string | null; analyseId: string | null; aipdReference: string | null; statut: string
  classe: Classe; revueEnRetard: boolean; manquants: string[]
}
interface Registre { systemes: Systeme[]; analyses: { id: string; nom: string }[]; synthese: { total: number; hautRisque: number; revuesEnRetard: number; aCompleter: number } }
interface ItemCatalogue { key: string; nom: string; usage: string; classe: Classe; status: 'NEW' | 'ALREADY_IMPORTED' | 'SIMILAR' }
type Form = Omit<Systeme, 'id' | 'classe' | 'revueEnRetard' | 'manquants' | 'donnees'> & { donnees: string }

const VIDE: Form = { nom: '', finalite: '', fournisseur: '', donnees: '', categoriesParticulieres: false, typeDecision: 'AIDE', interventionHumaine: '', usage: 'AUTRE', controlesBiais: '', derniereRevue: '', analyseId: '', aipdReference: '', statut: 'EN_PROJET' }
const CLASSE_STYLE: Record<Classe, string> = {
  HAUT_RISQUE_PROBABLE: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  RISQUE_LIMITE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  A_QUALIFIER: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
}
const field = 'mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800'

export default function RegistreIaManager() {
  const { t, locale } = useTranslation()
  const r = t.registreIa
  const [data, setData] = useState<Registre | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [edition, setEdition] = useState<{ id: string | null; form: Form } | null>(null)
  const [catalogue, setCatalogue] = useState<ItemCatalogue[] | null>(null)
  const [choix, setChoix] = useState<string[]>([])
  const [info, setInfo] = useState<string | null>(null)

  const charger = useCallback(async () => {
    const res = await fetch('/api/registre-ia', { cache: 'no-store' }).catch(() => null)
    if (res?.ok) setData(await res.json() as Registre); else setErreur(r.erreur)
  }, [r.erreur])
  useEffect(() => { void charger() }, [charger])

  async function ouvrirCatalogue() {
    if (catalogue) { setCatalogue(null); return }
    setInfo(null)
    const res = await fetch(`/api/registre-ia/catalogue?locale=${locale}`, { cache: 'no-store' }).catch(() => null)
    if (!res?.ok) { setErreur(r.erreur); return }
    const d = await res.json() as { items: ItemCatalogue[] }
    setCatalogue(d.items); setChoix(d.items.filter(i => i.status === 'NEW').map(i => i.key))
  }
  async function importer() {
    setBusy(true); setErreur(null)
    const res = await fetch('/api/registre-ia/catalogue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keys: choix, locale }) }).catch(() => null)
    setBusy(false)
    if (!res?.ok) { setErreur(r.erreur); return }
    const d = await res.json() as { created: string[] }
    setInfo(r.catalogue.importes.replace('{n}', String(d.created.length)))
    setCatalogue(null); await charger()
  }
  async function enregistrer() {
    if (!edition) return
    const f = edition.form
    if (!f.nom.trim()) { setErreur(r.nomRequis); return }
    setBusy(true); setErreur(null)
    const body = { ...f, donnees: f.donnees.split('\n').map(x => x.trim()).filter(Boolean), analyseId: f.analyseId || null, derniereRevue: f.derniereRevue || null }
    const res = await fetch(edition.id ? `/api/registre-ia/${edition.id}` : '/api/registre-ia', { method: edition.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    setBusy(false)
    if (!res?.ok) { setErreur(r.erreur); return }
    setEdition(null); await charger()
  }
  async function supprimer(s: Systeme) {
    if (!confirm(r.form.confirmerSuppression.replace('{nom}', s.nom))) return
    setBusy(true)
    const res = await fetch(`/api/registre-ia/${s.id}`, { method: 'DELETE' }).catch(() => null)
    setBusy(false)
    if (!res?.ok) { setErreur(r.erreur); return }
    await charger()
  }
  const modifier = (s: Systeme) => setEdition({ id: s.id, form: { ...s, fournisseur: s.fournisseur ?? '', donnees: s.donnees.join('\n'), interventionHumaine: s.interventionHumaine ?? '', controlesBiais: s.controlesBiais ?? '', derniereRevue: s.derniereRevue ? s.derniereRevue.slice(0, 10) : '', analyseId: s.analyseId ?? '', aipdReference: s.aipdReference ?? '' } })
  const set = (patch: Partial<Form>) => setEdition(e => (e ? { ...e, form: { ...e.form, ...patch } } : e))

  const usages = r.usages as Record<string, string>
  const statuts = r.statuts as Record<string, string>
  const decisions = r.decisions as Record<string, string>
  const manquantsLib = r.manquants as Record<string, string>
  const nomAnalyse = new Map((data?.analyses ?? []).map(a => [a.id, a.nom]))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100"><BrainCircuit size={22} className="mr-2 inline align-[-0.15em]" aria-hidden="true" />{r.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">{r.intro}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-sm" aria-expanded={!!catalogue} onClick={() => void ouvrirCatalogue()}>{r.importer}</button>
          <button type="button" className="btn-primary text-sm" onClick={() => { setErreur(null); setEdition({ id: null, form: VIDE }) }}>{r.ajouter}</button>
        </div>
      </div>
      <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">{r.avertissement}</p>
      {erreur && <p role="alert" className="text-sm text-red-700">{erreur}</p>}
      {info && <p role="status" className="text-sm text-green-700">{info}</p>}

      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([['total', data.synthese.total], ['hautRisque', data.synthese.hautRisque], ['revues', data.synthese.revuesEnRetard], ['aCompleter', data.synthese.aCompleter]] as const).map(([k, n]) => (
            <div key={k} className="card p-3"><p className="text-xs text-gray-500">{r.synthese[k]}</p><p className="text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{n}</p></div>
          ))}
        </div>
      )}

      {catalogue && (
        <section className="card p-4" aria-label={r.catalogue.titre}>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{r.catalogue.titre}</h2>
          <p className="mb-2 text-xs text-gray-500">{r.catalogue.hint}</p>
          <ul className="space-y-1">
            {catalogue.map(i => (
              <li key={i.key}>
                <label className={`flex flex-wrap items-center gap-2 text-sm ${i.status === 'ALREADY_IMPORTED' ? 'text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>
                  <input type="checkbox" disabled={i.status === 'ALREADY_IMPORTED' || busy} checked={i.status === 'ALREADY_IMPORTED' || choix.includes(i.key)}
                    onChange={() => setChoix(c => (c.includes(i.key) ? c.filter(k => k !== i.key) : [...c, i.key]))} />
                  {i.nom}
                  <span className="text-xs text-gray-500">{usages[i.usage] ?? i.usage}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${CLASSE_STYLE[i.classe]}`}>{r.classes[i.classe]}</span>
                  {i.status === 'ALREADY_IMPORTED' && <span className="text-[11px] italic">{r.catalogue.dejaImporte}</span>}
                  {i.status === 'SIMILAR' && <span className="text-[11px] italic text-amber-700">{r.catalogue.similaire}</span>}
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary text-sm disabled:opacity-50" disabled={busy || choix.length === 0} onClick={() => void importer()}>{r.catalogue.importer.replace('{n}', String(choix.length))}</button>
            <button type="button" className="btn-secondary text-sm" onClick={() => setCatalogue(null)}>{r.catalogue.fermer}</button>
          </div>
        </section>
      )}

      {edition && (
        <section className="card grid gap-3 p-4 sm:grid-cols-2" aria-label={edition.id ? r.form.modifier : r.ajouter}>
          <label className="text-xs text-gray-600 dark:text-gray-300">{r.form.nom}<input aria-label={r.form.nom} className={field} maxLength={200} value={edition.form.nom} onChange={e => set({ nom: e.target.value })} /></label>
          <label className="text-xs text-gray-600 dark:text-gray-300">{r.form.fournisseur}<input aria-label={r.form.fournisseur} className={field} maxLength={200} value={edition.form.fournisseur ?? ''} onChange={e => set({ fournisseur: e.target.value })} /></label>
          <label className="text-xs text-gray-600 sm:col-span-2 dark:text-gray-300">{r.form.finalite}<textarea aria-label={r.form.finalite} rows={2} className={field} maxLength={2000} value={edition.form.finalite} onChange={e => set({ finalite: e.target.value })} /></label>
          <label className="text-xs text-gray-600 dark:text-gray-300">{r.form.usage}
            <select aria-label={r.form.usage} className={field} value={edition.form.usage} onChange={e => set({ usage: e.target.value })}>{USAGES_IA.map(u => <option key={u} value={u}>{usages[u]}</option>)}</select>
          </label>
          <label className="text-xs text-gray-600 dark:text-gray-300">{r.form.typeDecision}
            <select aria-label={r.form.typeDecision} className={field} value={edition.form.typeDecision} onChange={e => set({ typeDecision: e.target.value })}>{DECISIONS_IA.map(d => <option key={d} value={d}>{decisions[d]}</option>)}</select>
          </label>
          <label className="text-xs text-gray-600 dark:text-gray-300">{r.form.donnees}<textarea aria-label={r.form.donnees} rows={3} className={field} value={edition.form.donnees} onChange={e => set({ donnees: e.target.value })} /></label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300"><input type="checkbox" checked={edition.form.categoriesParticulieres} onChange={e => set({ categoriesParticulieres: e.target.checked })} />{r.form.categoriesParticulieres}</label>
            <label className="block text-xs text-gray-600 dark:text-gray-300">{r.form.statut}
              <select aria-label={r.form.statut} className={field} value={edition.form.statut} onChange={e => set({ statut: e.target.value })}>{STATUTS_IA.map(s => <option key={s} value={s}>{statuts[s]}</option>)}</select>
            </label>
          </div>
          <label className="text-xs text-gray-600 dark:text-gray-300">{r.form.interventionHumaine}<textarea aria-label={r.form.interventionHumaine} rows={2} className={field} maxLength={2000} value={edition.form.interventionHumaine ?? ''} onChange={e => set({ interventionHumaine: e.target.value })} /></label>
          <label className="text-xs text-gray-600 dark:text-gray-300">{r.form.controlesBiais}<textarea aria-label={r.form.controlesBiais} rows={2} className={field} maxLength={2000} value={edition.form.controlesBiais ?? ''} onChange={e => set({ controlesBiais: e.target.value })} /></label>
          <label className="text-xs text-gray-600 dark:text-gray-300">{r.form.derniereRevue}<input type="date" aria-label={r.form.derniereRevue} className={field} value={edition.form.derniereRevue ?? ''} onChange={e => set({ derniereRevue: e.target.value })} /></label>
          <label className="text-xs text-gray-600 dark:text-gray-300">{r.form.analyse}
            <select aria-label={r.form.analyse} className={field} value={edition.form.analyseId ?? ''} onChange={e => set({ analyseId: e.target.value })}>
              <option value="">{r.form.aucune}</option>{(data?.analyses ?? []).map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600 dark:text-gray-300">{r.form.aipd}<input aria-label={r.form.aipd} className={field} maxLength={200} value={edition.form.aipdReference ?? ''} onChange={e => set({ aipdReference: e.target.value })} /></label>
          <div className="flex items-end gap-2">
            <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void enregistrer()}>{r.form.enregistrer}</button>
            <button type="button" className="btn-secondary text-sm" onClick={() => setEdition(null)}>{r.form.annuler}</button>
          </div>
        </section>
      )}

      {data && (data.systemes.length === 0 ? <p className="text-sm italic text-gray-500">{r.vide}</p> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-500"><tr>
              {(['nom', 'usage', 'decision', 'classe', 'statut', 'revue', 'analyse'] as const).map(c => <th key={c} className="px-3 py-2">{r.col[c]}</th>)}
              <th className="px-3 py-2"><span className="sr-only">{r.form.modifier}</span></th>
            </tr></thead>
            <tbody>{data.systemes.map(s => (
              <tr key={s.id} className={`border-t border-gray-100 dark:border-gray-800 ${s.statut === 'RETIRE' ? 'opacity-60' : ''}`}>
                <td className="px-3 py-2">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{s.nom}</p>
                  {s.manquants.length > 0 && <p className="text-[11px] text-amber-700">{r.aCompleterBadge.replace('{champs}', s.manquants.map(m => manquantsLib[m] ?? m).join(', '))}</p>}
                </td>
                <td className="px-3 py-2 text-xs">{usages[s.usage] ?? s.usage}</td>
                <td className="px-3 py-2 text-xs">{decisions[s.typeDecision] ?? s.typeDecision}</td>
                <td className="px-3 py-2"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] ${CLASSE_STYLE[s.classe]}`}>{r.classes[s.classe]}</span></td>
                <td className="px-3 py-2 text-xs">{statuts[s.statut] ?? s.statut}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">
                  {s.derniereRevue ? new Date(s.derniereRevue).toLocaleDateString(locale) : ''}
                  {s.revueEnRetard && <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700 dark:bg-red-500/20 dark:text-red-300">{s.derniereRevue ? r.enRetard : r.jamais}</span>}
                </td>
                <td className="px-3 py-2 text-xs">{s.analyseId ? <a href={`/analyses/${s.analyseId}`} className="text-ebios-700 hover:underline">{nomAnalyse.get(s.analyseId) ?? '—'}</a> : '—'}{s.aipdReference && <span className="block text-gray-500">{s.aipdReference}</span>}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button type="button" className="text-xs text-ebios-700 hover:underline" aria-label={`${r.form.modifier} — ${s.nom}`} onClick={() => modifier(s)}>{r.form.modifier}</button>
                  <button type="button" className="ml-2 text-xs text-red-700 hover:underline" disabled={busy} aria-label={`${r.form.supprimer} — ${s.nom}`} onClick={() => void supprimer(s)}>{r.form.supprimer}</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
