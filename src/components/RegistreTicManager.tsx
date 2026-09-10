'use client'

import { Plus, Download, Trash2, Pencil, AlertTriangle, ShieldAlert, ClipboardCheck, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import ConfirmDialog from '@/components/ConfirmDialog'
import { QUESTIONNAIRE_TIC, REPONSES_TIC, type ReponseQuestion, type ReponseTic } from '@/lib/tic-questionnaire'

const TYPES = ['HEBERGEMENT', 'CLOUD', 'LOGICIEL', 'RESEAU', 'SECURITE', 'DONNEES', 'SUPPORT', 'AUTRE'] as const
const CRITICITES = ['CRITIQUE', 'IMPORTANTE', 'NON_CRITIQUE'] as const

interface EcoResume { menace: number; zone: string; critique: boolean; occurrences: number }
interface QualifVerdict { total: number; repondu: number; pertinents: number; conformes: number; ecarts: string[]; score: number; complet: boolean }
interface Arrangement {
  id: string; reference: string; prestataireNom: string; identifiant: string | null; pays: string | null
  typeService: string; fonctionSupportee: string | null; criticite: string
  dateDebut: string | null; dateFin: string | null; paysDonnees: string | null; sousTraitance: boolean
  champsManquants: string[]
  ecosysteme?: EcoResume | null
  qualification?: QualifVerdict
  questionnaire?: ReponseQuestion[]
}

const ZONE_BADGE: Record<string, string> = {
  danger: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  controle: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  veille: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}
const scoreTone = (s: number) => s >= 80 ? 'text-green-700 dark:text-green-400' : s >= 50 ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'
interface Synthese { arrangements: number; prestataires: number; critiques: number; sousTraitance: number; concentrationTop: { prestataire: string; part: number } | null; expirentBientot: number }
interface Completude { total: number; complets: number; incomplets: number; taux: number }

const CRIT_BADGE: Record<string, string> = {
  CRITIQUE: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  IMPORTANTE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  NON_CRITIQUE: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

const emptyForm = {
  reference: '', prestataireNom: '', identifiant: '', pays: '', typeService: 'CLOUD',
  fonctionSupportee: '', criticite: 'NON_CRITIQUE', dateDebut: '', dateFin: '', paysDonnees: '', sousTraitance: false,
}

export default function RegistreTicManager({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation()
  const r = t.registreTic
  const [data, setData] = useState<{ arrangements: Arrangement[]; synthese: Synthese; completude: Completude } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [err, setErr] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  async function reload() {
    const d = await fetch('/api/reglementaire/registre-tic').then(x => x.ok ? x.json() : null).catch(() => null)
    setData({
      arrangements: d?.arrangements ?? [],
      synthese: d?.synthese ?? { arrangements: 0, prestataires: 0, critiques: 0, sousTraitance: 0, concentrationTop: null, expirentBientot: 0 },
      completude: d?.completude ?? { total: 0, complets: 0, incomplets: 0, taux: 1 },
    })
    setLoading(false)
  }
  useEffect(() => { reload() }, [])

  function openCreate() { setEditing(null); setForm({ ...emptyForm }); setErr(null); setShowForm(true) }
  function openEdit(a: Arrangement) {
    setEditing(a.id)
    setForm({
      reference: a.reference, prestataireNom: a.prestataireNom, identifiant: a.identifiant ?? '', pays: a.pays ?? '',
      typeService: a.typeService, fonctionSupportee: a.fonctionSupportee ?? '', criticite: a.criticite,
      dateDebut: a.dateDebut ? a.dateDebut.slice(0, 10) : '', dateFin: a.dateFin ? a.dateFin.slice(0, 10) : '',
      paysDonnees: a.paysDonnees ?? '', sousTraitance: a.sousTraitance,
    })
    setErr(null); setShowForm(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const url = editing ? `/api/reglementaire/registre-tic/${editing}` : '/api/reglementaire/registre-tic'
    const res = await fetch(url, { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setErr(d.error === 'reference_requise' || d.error === 'prestataire_requis' ? r.errorRequired : (d.error || 'Erreur'))
      return
    }
    setShowForm(false); reload()
  }
  async function del(id: string) { await fetch(`/api/reglementaire/registre-tic/${id}`, { method: 'DELETE' }); setConfirmDel(null); reload() }

  // Questionnaire de qualification (due diligence DORA art. 28) : dépliage + édition inline.
  const [openQ, setOpenQ] = useState<string | null>(null)
  const [qDraft, setQDraft] = useState<Record<string, { reponse: string; commentaire: string }>>({})
  const [qBusy, setQBusy] = useState(false)
  function toggleQ(a: Arrangement) {
    if (openQ === a.id) { setOpenQ(null); return }
    const draft: Record<string, { reponse: string; commentaire: string }> = {}
    for (const rep of a.questionnaire ?? []) draft[rep.id] = { reponse: rep.reponse, commentaire: rep.commentaire ?? '' }
    setQDraft(draft); setOpenQ(a.id)
  }
  async function saveQuestionnaire(a: Arrangement) {
    setQBusy(true); setErr(null)
    const questionnaire: ReponseQuestion[] = QUESTIONNAIRE_TIC
      .filter(q => qDraft[q.id]?.reponse)
      .map(q => ({ id: q.id, reponse: qDraft[q.id].reponse as ReponseTic, ...(qDraft[q.id].commentaire.trim() ? { commentaire: qDraft[q.id].commentaire.trim() } : {}) }))
    // PATCH = remplacement : renvoyer les champs existants + le questionnaire édité.
    const body = {
      reference: a.reference, prestataireNom: a.prestataireNom, identifiant: a.identifiant, pays: a.pays,
      typeService: a.typeService, fonctionSupportee: a.fonctionSupportee, criticite: a.criticite,
      dateDebut: a.dateDebut, dateFin: a.dateFin, paysDonnees: a.paysDonnees, sousTraitance: a.sousTraitance,
      questionnaire,
    }
    const res = await fetch(`/api/reglementaire/registre-tic/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setQBusy(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error || 'Erreur'); return }
    setOpenQ(null); reload()
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-ebios-500'

  if (loading) return <div className="text-center py-12 text-gray-500">{t.loading}</div>
  const { arrangements, synthese, completude } = data!

  const kpi = (label: string, value: string | number, tone = 'text-gray-900 dark:text-gray-100') => (
    <div className="card p-4">
      <div className={`text-2xl font-bold ${tone} tabular-nums`}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 leading-snug mt-0.5">{label}</div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{r.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">{r.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/reglementaire/registre-tic?format=csv"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
            <Download size={15} aria-hidden="true" /> {r.export}
          </a>
          {canManage && (
            <button onClick={openCreate}
              className="inline-flex items-center gap-1.5 bg-ebios-600 hover:bg-ebios-700 text-white text-sm font-medium py-2 px-3 rounded-lg">
              <Plus size={15} aria-hidden="true" /> {r.add}
            </button>
          )}
        </div>
      </div>

      {!canManage && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          {r.readOnly}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpi(r.kpi.arrangements, synthese.arrangements)}
        {kpi(r.kpi.prestataires, synthese.prestataires)}
        {kpi(r.kpi.critiques, synthese.critiques, synthese.critiques > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100')}
        {kpi(r.kpi.concentration, synthese.concentrationTop ? `${Math.round(synthese.concentrationTop.part * 100)}%` : '—')}
        {kpi(r.kpi.expirent, synthese.expirentBientot, synthese.expirentBientot > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100')}
        {kpi(r.kpi.completude, `${Math.round(completude.taux * 100)}%`, completude.incomplets > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400')}
      </div>
      {synthese.concentrationTop && (
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-3 flex items-center gap-1">
          <ShieldAlert size={13} aria-hidden="true" /> {r.kpi.concentration} : <b className="text-gray-700 dark:text-gray-200">{synthese.concentrationTop.prestataire}</b>
        </p>
      )}

      {/* Formulaire */}
      {showForm && canManage && (
        <form onSubmit={save} className="card p-5 space-y-4">
          {err && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 text-sm"><AlertTriangle size={14} className="inline align-[-0.15em] mr-1" aria-hidden="true" /> {err}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{r.champ.reference}</span>
              <input className={`mt-1 ${inputCls}`} value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} required /></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{r.champ.prestataire}</span>
              <input className={`mt-1 ${inputCls}`} value={form.prestataireNom} onChange={e => setForm({ ...form, prestataireNom: e.target.value })} required /></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{r.champ.identifiant}</span>
              <input className={`mt-1 ${inputCls}`} value={form.identifiant} onChange={e => setForm({ ...form, identifiant: e.target.value })} placeholder="LEI" /></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{r.champ.pays}</span>
              <input className={`mt-1 ${inputCls}`} value={form.pays} onChange={e => setForm({ ...form, pays: e.target.value })} placeholder="FR" maxLength={2} /></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{r.champ.typeService}</span>
              <select className={`mt-1 ${inputCls}`} value={form.typeService} onChange={e => setForm({ ...form, typeService: e.target.value })}>
                {TYPES.map(ty => <option key={ty} value={ty}>{r.typeOpt[ty]}</option>)}
              </select></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{r.champ.criticite}</span>
              <select className={`mt-1 ${inputCls}`} value={form.criticite} onChange={e => setForm({ ...form, criticite: e.target.value })}>
                {CRITICITES.map(c => <option key={c} value={c}>{r.criticiteOpt[c]}</option>)}
              </select></label>
            <label className="block sm:col-span-2"><span className="text-sm text-gray-700 dark:text-gray-300">{r.champ.fonctionSupportee}</span>
              <input className={`mt-1 ${inputCls}`} value={form.fonctionSupportee} onChange={e => setForm({ ...form, fonctionSupportee: e.target.value })} /></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{r.champ.dateDebut}</span>
              <input type="date" className={`mt-1 ${inputCls}`} value={form.dateDebut} onChange={e => setForm({ ...form, dateDebut: e.target.value })} /></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{r.champ.dateFin}</span>
              <input type="date" className={`mt-1 ${inputCls}`} value={form.dateFin} onChange={e => setForm({ ...form, dateFin: e.target.value })} /></label>
            <label className="block"><span className="text-sm text-gray-700 dark:text-gray-300">{r.champ.paysDonnees}</span>
              <input className={`mt-1 ${inputCls}`} value={form.paysDonnees} onChange={e => setForm({ ...form, paysDonnees: e.target.value })} placeholder="FR" maxLength={2} /></label>
            <label className="flex items-center gap-2 mt-6"><input type="checkbox" checked={form.sousTraitance} onChange={e => setForm({ ...form, sousTraitance: e.target.checked })} />
              <span className="text-sm text-gray-700 dark:text-gray-300">{r.champ.sousTraitance}</span></label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-ebios-600 hover:bg-ebios-700 text-white text-sm font-medium py-2 px-4 rounded-lg">{t.save}</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm py-2 px-4">{t.cancel}</button>
          </div>
        </form>
      )}

      {/* Tableau */}
      {arrangements.length === 0 ? (
        <div className="card p-10 text-center text-gray-400 dark:text-gray-500 text-sm">{r.empty}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs">
              <tr>
                <th className="text-left font-medium px-3 py-2">{r.champ.reference}</th>
                <th className="text-left font-medium px-3 py-2">{r.champ.prestataire}</th>
                <th className="text-left font-medium px-3 py-2">{r.champ.typeService}</th>
                <th className="text-left font-medium px-3 py-2">{r.champ.criticite}</th>
                <th className="text-left font-medium px-3 py-2">{r.qualif.colEco}</th>
                <th className="text-left font-medium px-3 py-2">{r.qualif.col}</th>
                <th className="text-left font-medium px-3 py-2">{r.champ.dateFin}</th>
                <th className="text-left font-medium px-3 py-2">{r.complet}</th>
                {canManage && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {arrangements.flatMap(a => [
                <tr key={a.id} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">{a.reference}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-200">
                    {a.prestataireNom}
                    {a.sousTraitance && <span className="ml-1.5 text-[10px] text-gray-400" title={r.champ.sousTraitance}>⛓</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.typeOpt[a.typeService as keyof typeof r.typeOpt] ?? a.typeService}</td>
                  <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CRIT_BADGE[a.criticite] ?? CRIT_BADGE.NON_CRITIQUE}`}>{r.criticiteOpt[a.criticite as keyof typeof r.criticiteOpt] ?? a.criticite}</span></td>
                  <td className="px-3 py-2">
                    {a.ecosysteme ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ZONE_BADGE[a.ecosysteme.zone] ?? ZONE_BADGE.veille}`}
                        title={`${r.qualif.ecoMenace} : ${a.ecosysteme.menace.toFixed(1)}${a.ecosysteme.critique ? ' · ' + r.qualif.ecoCritique : ''}`}>
                        {a.ecosysteme.critique && '★ '}{(r.qualif.ecoZones as Record<string, string>)[a.ecosysteme.zone] ?? a.ecosysteme.zone}
                      </span>
                    ) : <span className="text-[11px] text-gray-400" title={r.qualif.ecoAbsentHint}>{r.qualif.ecoAbsent}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => toggleQ(a)} className="inline-flex items-center gap-1 text-xs hover:underline" aria-expanded={openQ === a.id}>
                      <ClipboardCheck size={13} aria-hidden="true" className="text-gray-400" />
                      {a.qualification && a.qualification.repondu > 0
                        ? <span className={`font-semibold ${scoreTone(a.qualification.score)}`}>{a.qualification.score}%<span className="text-gray-400 font-normal"> · {a.qualification.repondu}/{a.qualification.total}</span></span>
                        : <span className="text-ebios-600 dark:text-ebios-300">{r.qualif.evaluer}</span>}
                      <ChevronDown size={12} aria-hidden="true" className={`text-gray-400 transition-transform ${openQ === a.id ? 'rotate-180' : ''}`} />
                    </button>
                  </td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400 tabular-nums">{a.dateFin ? a.dateFin.slice(0, 10) : '—'}</td>
                  <td className="px-3 py-2">
                    {a.champsManquants.length === 0
                      ? <span className="text-xs text-green-700 dark:text-green-400 font-medium">{r.complet}</span>
                      : <span className="text-xs text-amber-700 dark:text-amber-400 font-medium" title={`${r.manque} : ${a.champsManquants.join(', ')}`}>{r.incomplet} ({a.champsManquants.length})</span>}
                  </td>
                  {canManage && (
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(a)} className="text-gray-400 hover:text-ebios-600 p-1" aria-label={t.save}><Pencil size={15} aria-hidden="true" /></button>
                      <button onClick={() => setConfirmDel(a.id)} className="text-gray-400 hover:text-red-600 p-1" aria-label={t.delete}><Trash2 size={15} aria-hidden="true" /></button>
                    </td>
                  )}
                </tr>,
                openQ === a.id && (
                  <tr key={a.id + '-q'} className="bg-gray-50 dark:bg-gray-800/40">
                    <td colSpan={canManage ? 7 : 6} className="px-4 py-3">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                        <ClipboardCheck size={14} aria-hidden="true" /> {r.qualif.title}
                      </p>
                      <div className="space-y-1.5">
                        {QUESTIONNAIRE_TIC.map(q => (
                          <div key={q.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center border-b border-gray-100 dark:border-gray-700 pb-1.5">
                            <span className="text-xs text-gray-700 dark:text-gray-200">{q.question}</span>
                            <div className="flex items-center gap-2">
                              <select value={qDraft[q.id]?.reponse ?? ''} disabled={!canManage}
                                onChange={e => setQDraft(d => ({ ...d, [q.id]: { reponse: e.target.value, commentaire: d[q.id]?.commentaire ?? '' } }))}
                                className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100">
                                <option value="">{r.qualif.reponses.VIDE}</option>
                                {REPONSES_TIC.map(rep => <option key={rep} value={rep}>{(r.qualif.reponses as Record<string, string>)[rep]}</option>)}
                              </select>
                              <input type="text" value={qDraft[q.id]?.commentaire ?? ''} disabled={!canManage}
                                onChange={e => setQDraft(d => ({ ...d, [q.id]: { reponse: d[q.id]?.reponse ?? '', commentaire: e.target.value } }))}
                                placeholder={r.qualif.commentaire}
                                className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 w-40" />
                            </div>
                          </div>
                        ))}
                      </div>
                      {canManage && (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => saveQuestionnaire(a)} disabled={qBusy} className="bg-ebios-600 hover:bg-ebios-700 text-white text-xs font-medium py-1.5 px-3 rounded-lg disabled:opacity-50">{r.qualif.save}</button>
                          <button onClick={() => setOpenQ(null)} className="btn-secondary text-xs py-1.5 px-3">{t.cancel}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ),
              ]).flat().filter(Boolean)}
            </tbody>
          </table>
        </div>
      )}

      {confirmDel && (
        <ConfirmDialog
          message={r.deleteConfirm}
          confirmLabel={t.delete}
          onConfirm={() => del(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  )
}
