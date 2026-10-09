'use client'

// ─── Registre des traitements (RGPD / ROPA) ───────────────────────────────────
//
// Registre des activités de traitement (art. 30 RGPD) : finalité, base légale
// (lib/ropa), catégories de personnes/données, destinataires, transferts hors
// UE, durée de conservation, mesures de sécurité. Évalue la complétude et le
// besoin d'AIPD (PIA). Cf. /api/.../ropa.

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import AipdSuiviPanel from '@/components/AipdSuiviPanel'
import { ShieldCheck, AlertTriangle, CheckCircle2, Trash2, Plus, Download } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { BASES_LEGALES, CRITERES_AIPD, type CritereAipd } from '@/lib/ropa'
import { detectRgpdArt9 } from '@/lib/rgpd-sensitive'
import RopaCataloguePanel from '@/components/RopaCataloguePanel'
import RevuePeriodiqueChamp from '@/components/RevuePeriodiqueChamp'
import RopaIdentiteCard from '@/components/RopaIdentiteCard'

interface Evaluation { complet: boolean; champsManquants: string[]; pia: { requis: boolean; niveau?: 'REQUISE' | 'A_EXAMINER' | 'NON'; motifs: string[] }; alerteAipd?: 'A_LANCER' | 'JUSTIFICATION_REQUISE' | null }
interface Traitement {
  id: string; nom: string; finalite: string; baseLegale: string
  categoriesPersonnes: string[]; categoriesDonnees: string[]; destinataires: string[]
  transfertHorsUE: boolean; paysTransfert?: string; garantiesTransfert?: string
  dureeConservation: string; mesuresSecurite: string[]
  grandeEchelle?: boolean; surveillanceSystematique?: boolean; criteresAipd?: string[]
  // Suivi de l'AIPD (art. 35-36).
  aipdStatut?: string | null; aipdAnalyseId?: string | null; aipdDate?: string | null; aipdJustification?: string; aipdConsultationPrealable?: boolean
  aipdAnalyse?: { id: string; nom: string } | null
  // Revue périodique (lib/revues).
  derniereRevue?: string | null; createdAt?: string
  evaluation: Evaluation
}
type Form = {
  nom: string; finalite: string; baseLegale: string
  categoriesPersonnes: string; categoriesDonnees: string; destinataires: string; mesuresSecurite: string
  dureeConservation: string; transfertHorsUE: boolean; paysTransfert: string; garantiesTransfert: string
  grandeEchelle: boolean; surveillanceSystematique: boolean; criteresAipd: string[]
  derniereRevue: string
}
const EMPTY: Form = {
  nom: '', finalite: '', baseLegale: '', categoriesPersonnes: '', categoriesDonnees: '', destinataires: '',
  mesuresSecurite: '', dureeConservation: '', transfertHorsUE: false, paysTransfert: '', garantiesTransfert: '',
  grandeEchelle: false, surveillanceSystematique: false, criteresAipd: [], derniereRevue: '',
}
const toArr = (s: string) => s.split(/[,;\n]/).map(x => x.trim()).filter(Boolean)
const toStr = (a: string[]) => (a ?? []).join(', ')

export default function RopaManager() {
  const { t } = useTranslation()
  const r = t.ropa
  // Libellés des champs de l'art. 30 (codes renvoyés par lib/ropa) et des motifs d'AIPD (art. 35).
  const libelleChamp: Record<string, string> = {
    nom: r.fNom, finalite: r.fFinalite, categoriesPersonnes: r.fPersonnes, categoriesDonnees: r.fDonnees, destinataires: r.fDestinataires,
    dureeConservation: r.fDuree, mesuresSecurite: r.fMesures, garantiesTransfert: r.fGaranties,
  }
  const libelleMotif = (m: string) => (r.criteres as Record<string, string>)[m] ?? m
  const [items, setItems] = useState<Traitement[]>([])
  const [synthese, setSynthese] = useState({ total: 0, complets: 0, piaRequis: 0, aipdALancer: 0 })
  const [suiviId, setSuiviId] = useState<string | null>(null)
  const [peutCreerAnalyse, setPeutCreerAnalyse] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Form>(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    const d = await fetch('/api/ropa').then(x => x.ok ? x.json() : { traitements: [] }).catch(() => ({ traitements: [] }))
    setItems(d.traitements ?? []); setSynthese({ aipdALancer: 0, ...(d.synthese ?? { total: 0, complets: 0, piaRequis: 0 }) }); setPeutCreerAnalyse(!!d.peutCreerAnalyse); setLoading(false)
  }
  useEffect(() => { reload() }, [])

  const inp = 'px-2 py-1.5 rounded-sm border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm w-full'

  function openCreate() { setForm(EMPTY); setEditId(null); setError(null); setShowForm(true) }
  function openEdit(x: Traitement) {
    setEditId(x.id); setError(null); setShowForm(true)
    setForm({
      nom: x.nom, finalite: x.finalite, baseLegale: x.baseLegale,
      categoriesPersonnes: toStr(x.categoriesPersonnes), categoriesDonnees: toStr(x.categoriesDonnees),
      destinataires: toStr(x.destinataires), mesuresSecurite: toStr(x.mesuresSecurite),
      dureeConservation: x.dureeConservation, transfertHorsUE: !!x.transfertHorsUE, paysTransfert: x.paysTransfert ?? '',
      garantiesTransfert: x.garantiesTransfert ?? '', grandeEchelle: !!x.grandeEchelle, surveillanceSystematique: !!x.surveillanceSystematique, criteresAipd: x.criteresAipd ?? [],
      derniereRevue: x.derniereRevue ? x.derniereRevue.slice(0, 10) : '',
    })
  }

  // Catégories particulières (art. 9) détectées dans les catégories de données saisies : critère « données sensibles » déduit.
  const sensiblesDetectees = detectRgpdArt9(toArr(form.categoriesDonnees).map(nom => ({ nom }))).length > 0
  function basculerCritere(c: CritereAipd, actif: boolean) {
    if (c === 'GRANDE_ECHELLE') return setForm(f => ({ ...f, grandeEchelle: actif }))
    if (c === 'SURVEILLANCE') return setForm(f => ({ ...f, surveillanceSystematique: actif }))
    setForm(f => ({ ...f, criteresAipd: actif ? [...f.criteresAipd.filter(x => x !== c), c] : f.criteresAipd.filter(x => x !== c) }))
  }

  async function submit() {
    if (!form.nom.trim()) { setError(r.err_nom); return }
    setBusy(true); setError(null)
    const payload = {
      nom: form.nom, finalite: form.finalite, baseLegale: form.baseLegale,
      categoriesPersonnes: toArr(form.categoriesPersonnes), categoriesDonnees: toArr(form.categoriesDonnees),
      destinataires: toArr(form.destinataires), mesuresSecurite: toArr(form.mesuresSecurite),
      dureeConservation: form.dureeConservation, transfertHorsUE: form.transfertHorsUE,
      paysTransfert: form.paysTransfert, garantiesTransfert: form.garantiesTransfert,
      grandeEchelle: form.grandeEchelle, surveillanceSystematique: form.surveillanceSystematique,
      // Grande échelle et surveillance restent portées par leurs champs ; les autres critères WP248 sont listés.
      criteresAipd: form.criteresAipd.filter(c => c !== 'GRANDE_ECHELLE' && c !== 'SURVEILLANCE'),
      derniereRevue: form.derniereRevue,
    }
    const res = await fetch(editId ? `/api/ropa/${editId}` : '/api/ropa', {
      method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    setBusy(false)
    if (!res.ok) { setError(r.err_generic); return }
    setForm(EMPTY); setEditId(null); setShowForm(false); reload()
  }
  async function remove(id: string) {
    if (!confirm(r.deleteConfirm)) return
    await fetch(`/api/ropa/${id}`, { method: 'DELETE' }); reload()
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100"><ShieldCheck size={22} className="inline align-[-0.2em] mr-2" aria-hidden="true" />{r.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{r.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Art. 30 §4 : le registre est mis à la disposition de l'autorité de contrôle sur demande. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- téléchargement servi par une route API, pas une page */}
          {items.length > 0 && <a href="/api/ropa/export" className="btn-secondary text-sm inline-flex items-center gap-1"><Download size={16} aria-hidden="true" />{r.exporter}</a>}
          {!showForm && <button onClick={openCreate} className="btn-primary text-sm inline-flex items-center gap-1"><Plus size={16} />{r.add}</button>}
        </div>
      </div>

      <RopaIdentiteCard />
      <RopaCataloguePanel onImported={reload} />

      {/* Synthèse */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-3"><div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{synthese.total}</div><div className="text-xs text-gray-500">{r.kTotal}</div></div>
        <div className="card p-3"><div className="text-2xl font-bold text-green-600">{synthese.complets}</div><div className="text-xs text-gray-500">{r.kComplets}</div></div>
        <div className="card p-3"><div className="text-2xl font-bold text-amber-600">{synthese.piaRequis}</div><div className="text-xs text-gray-500">{r.kPia}</div></div>
        <div className="card p-3"><div className={`text-2xl font-bold ${synthese.aipdALancer ? 'text-red-600' : 'text-gray-400'}`}>{synthese.aipdALancer}</div><div className="text-xs text-gray-500">{r.aipd.kALancer}</div></div>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="card p-5 mb-6 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs text-gray-500">{r.fNom}<input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} className={`${inp} mt-1`} /></label>
            <label className="text-xs text-gray-500">{r.fBase}
              <select value={form.baseLegale} onChange={e => setForm(f => ({ ...f, baseLegale: e.target.value }))} className={`${inp} mt-1`}>
                <option value="">—</option>
                {BASES_LEGALES.map(b => <option key={b} value={b}>{(r.bases as Record<string, string>)[b] ?? b}</option>)}
              </select>
            </label>
          </div>
          <label className="text-xs text-gray-500 block">{r.fFinalite}<textarea value={form.finalite} onChange={e => setForm(f => ({ ...f, finalite: e.target.value }))} rows={2} className={`${inp} mt-1`} /></label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs text-gray-500">{r.fPersonnes}<input value={form.categoriesPersonnes} onChange={e => setForm(f => ({ ...f, categoriesPersonnes: e.target.value }))} placeholder={r.csvHint} className={`${inp} mt-1`} /></label>
            <label className="text-xs text-gray-500">{r.fDonnees}<input value={form.categoriesDonnees} onChange={e => setForm(f => ({ ...f, categoriesDonnees: e.target.value }))} placeholder={r.csvHint} className={`${inp} mt-1`} /></label>
            <label className="text-xs text-gray-500">{r.fDestinataires}<input value={form.destinataires} onChange={e => setForm(f => ({ ...f, destinataires: e.target.value }))} placeholder={r.csvHint} className={`${inp} mt-1`} /></label>
            <label className="text-xs text-gray-500">{r.fMesures}<input value={form.mesuresSecurite} onChange={e => setForm(f => ({ ...f, mesuresSecurite: e.target.value }))} placeholder={r.csvHint} className={`${inp} mt-1`} /></label>
            <label className="text-xs text-gray-500">{r.fDuree}<input value={form.dureeConservation} onChange={e => setForm(f => ({ ...f, dureeConservation: e.target.value }))} className={`${inp} mt-1`} /></label>
            <RevuePeriodiqueChamp valeur={form.derniereRevue} creeLe={items.find(x => x.id === editId)?.createdAt} onChange={v => setForm(f => ({ ...f, derniereRevue: v }))} />
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-300">
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={form.transfertHorsUE} onChange={e => setForm(f => ({ ...f, transfertHorsUE: e.target.checked }))} />{r.fTransfert}</label>
            {/* Critères de risque élevé des lignes directrices WP248 rév. 01 : AIPD en principe requise dès deux critères. */}
            <fieldset className="w-full">
              <legend className="text-xs font-medium text-gray-600 dark:text-gray-300">{r.criteresTitre}</legend>
              <p className="text-[11px] text-gray-500 mb-1">{r.aideCriteres}</p>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
                {CRITERES_AIPD.map(c => {
                  const deduit = c === 'DONNEES_SENSIBLES' && sensiblesDetectees
                  const coche = c === 'GRANDE_ECHELLE' ? form.grandeEchelle : c === 'SURVEILLANCE' ? form.surveillanceSystematique : deduit || form.criteresAipd.includes(c)
                  return (
                    <label key={c} className="inline-flex items-start gap-1.5 text-xs text-gray-700 dark:text-gray-200">
                      <input type="checkbox" className="mt-0.5" aria-label={r.criteres[c]} checked={coche} disabled={deduit} onChange={e => basculerCritere(c, e.target.checked)} />
                      <span>{r.criteres[c]}{deduit && <span className="text-gray-400"> ({r.deduit})</span>}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          </div>
          {form.transfertHorsUE && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs text-gray-500">{r.fPays}<input value={form.paysTransfert} onChange={e => setForm(f => ({ ...f, paysTransfert: e.target.value }))} className={`${inp} mt-1`} /></label>
              <label className="text-xs text-gray-500">{r.fGaranties}<input value={form.garantiesTransfert} onChange={e => setForm(f => ({ ...f, garantiesTransfert: e.target.value }))} className={`${inp} mt-1`} /></label>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{editId ? r.save : r.create}</button>
            <button onClick={() => { setShowForm(false); setEditId(null); setError(null) }} className="btn-secondary text-sm">{r.cancel}</button>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? <p className="text-sm text-gray-400">…</p>
        : items.length === 0 ? <p className="text-sm text-gray-400 italic">{r.empty}</p>
        : (
          <div className="overflow-x-auto card">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2">{r.fNom}</th><th className="px-3 py-2">{r.fBase}</th><th className="px-3 py-2">{r.colStatus}</th><th className="px-3 py-2">{r.colPia}</th><th className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {items.map(x => (
                  <Fragment key={x.id}>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">{x.nom}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{(r.bases as Record<string, string>)[x.baseLegale] ?? <span className="text-red-500">{r.baseManquante}</span>}</td>
                    <td className="px-3 py-2">
                      {x.evaluation.complet
                        ? <span className="text-[11px] inline-flex items-center gap-1 text-green-700 bg-green-100 dark:bg-green-500/15 dark:text-green-300 px-1.5 py-0.5 rounded-full"><CheckCircle2 size={12} />{r.complet}</span>
                        : <span className="text-[11px] inline-flex items-center gap-1 text-amber-800 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300 px-1.5 py-0.5 rounded-full" ><AlertTriangle size={12} />{r.incomplet} ({x.evaluation.champsManquants.length})</span>}
                      {!x.evaluation.complet && <span className="block mt-0.5 text-[11px] text-amber-800 dark:text-amber-300">{r.manque.replace('{champs}', x.evaluation.champsManquants.map(c => libelleChamp[c] ?? c).join(', '))}</span>}
                    </td>
                    <td className="px-3 py-2">{(x.evaluation.pia.niveau ?? (x.evaluation.pia.requis ? 'REQUISE' : 'NON')) !== 'NON' && (() => {
                      const niveau = x.evaluation.pia.niveau ?? 'REQUISE'
                      const ton = niveau === 'REQUISE' ? 'text-red-800 bg-red-100 dark:bg-red-500/20 dark:text-red-300' : 'text-amber-800 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300'
                      return <>
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${ton}`}>{r.niveaux[niveau]}</span>
                        <span className="block mt-0.5 text-[11px] text-gray-600 dark:text-gray-300">{x.evaluation.pia.motifs.map(libelleMotif).join(' ; ')}</span>
                      </>
                    })()}
                      {/* Suivi de l'AIPD : statut, analyse rattachée, point d'attention. */}
                      {x.aipdStatut && <span className="block mt-0.5 text-[11px] text-gray-700 dark:text-gray-200">{(r.aipd.statuts as Record<string, string>)[x.aipdStatut] ?? x.aipdStatut}{x.aipdDate ? ` · ${x.aipdDate.slice(0, 10)}` : ''}{x.aipdConsultationPrealable ? ` · ${r.aipd.consultation.split(' (')[0]}` : ''}</span>}
                      {x.aipdAnalyse && <Link href={`/analyses/${x.aipdAnalyse.id}`} className="block text-[11px] text-ebios-700 dark:text-ebios-300 underline">{x.aipdAnalyse.nom}</Link>}
                      {x.evaluation.alerteAipd && <span className="block mt-0.5 text-[11px] font-medium text-red-700 dark:text-red-300">{x.evaluation.alerteAipd === 'A_LANCER' ? r.aipd.alerteALancer : r.aipd.alerteJustification}</span>}
                      {((x.evaluation.pia.niveau ?? 'NON') !== 'NON' || x.aipdStatut) && <button type="button" onClick={() => setSuiviId(suiviId === x.id ? null : x.id)} aria-label={`${r.aipd.suivre} ${x.nom}`} className="mt-0.5 text-[11px] text-ebios-700 dark:text-ebios-300 hover:underline">{r.aipd.suivre}</button>}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(x)} className="text-xs text-ebios-600 hover:underline mr-2">{r.edit}</button>
                      <button onClick={() => remove(x.id)} className="text-gray-400 hover:text-red-600 p-1" aria-label={r.delete}><Trash2 size={15} aria-hidden="true" /></button>
                    </td>
                  </tr>
                  {suiviId === x.id && (
                    <tr><td colSpan={5} className="px-3 pb-3">
                      <AipdSuiviPanel peutCreerAnalyse={peutCreerAnalyse} onAnnuler={() => setSuiviId(null)} onEnregistre={() => { setSuiviId(null); reload() }}
                        traitement={{ id: x.id, nom: x.nom, aipdStatut: x.aipdStatut ?? null, aipdAnalyseId: x.aipdAnalyseId ?? null, aipdDate: x.aipdDate ?? null, aipdJustification: x.aipdJustification ?? '', aipdConsultationPrealable: !!x.aipdConsultationPrealable }} />
                    </td></tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}
