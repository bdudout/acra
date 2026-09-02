'use client'

import { FlaskConical, Paperclip } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { CONTROLE_NIVEAUX, PERIODICITES, RESULTATS, deduireResultatChecklist, filtrerControles, type ControleFiltre } from '@/lib/controle'
import { CATALOGUES_CONTROLES } from '@/lib/controles-catalogue'
import { todayInputDate, suggestionsFromValues, defaultResponsable } from '@/lib/form-defaults'

interface Efficacite {
  evaluees: number; conformes: number; anomalies: number
  tauxConformite: number | null
  efficacite: 'FORTE' | 'MOYENNE' | 'FAIBLE' | null
  vraisemblanceSuggeree: number | null
}
interface Preuve { nom: string; mime: string; taille: number; dataUrl: string }
type ChecklistStatut = 'OK' | 'KO' | 'NA'
interface ChecklistResultat { label: string; statut: ChecklistStatut; commentaire?: string | null }
interface Execution { id: string; resultat: string; dateRealisation: string; constat: string | null; preuves: Preuve[]; checklistResultats?: ChecklistResultat[]; independant?: boolean | null }
interface Controle {
  id: string; intitule: string; description: string | null
  niveau: string; periodicite: string; responsable: string | null
  tailleEchantillon: number | null; actif: boolean
  riskItemId: string | null; riskItemIntitule: string | null
  processusId: string | null; processusNom: string | null
  referentielCode: string | null; exigenceRefs: string[]
  checklist: string[]; superviseIds: string[]
  derniereExecution: string | null; prochaineEcheance: string
  etatEcheance: 'A_VENIR' | 'DU' | 'EN_RETARD' | null
  efficacite: Efficacite; executions: Execution[]; nbExecutions: number
}
type Proc = { id: string; nom: string }
type Risk = { id: string; intitule: string }
type RefLite = { code: string; nom: string }
type ExigenceLite = { ref: string; nom: string }

type Form = {
  intitule: string; description: string; niveau: string; periodicite: string
  responsable: string; riskItemId: string; processusId: string; tailleEchantillon: string
  referentielCode: string; exigenceRefs: string[]; checklist: string[]; superviseIds: string[]
}
const EMPTY: Form = { intitule: '', description: '', niveau: 'N1', periodicite: 'TRIMESTRIEL', responsable: '', riskItemId: '', processusId: '', tailleEchantillon: '', referentielCode: '', exigenceRefs: [], checklist: [], superviseIds: [] }

type ExecForm = { resultat: string; dateRealisation: string; constat: string; tailleTestee: string; anomaliesTrouvees: string; checklist: ChecklistResultat[]; independant: boolean }
const EMPTY_EXEC: ExecForm = { resultat: 'CONFORME', dateRealisation: '', constat: '', tailleTestee: '', anomaliesTrouvees: '', checklist: [], independant: false }

const ECHEANCE_BADGE: Record<string, string> = {
  A_VENIR: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  DU: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  EN_RETARD: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
}
const EFF_BADGE: Record<string, string> = {
  FORTE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  MOYENNE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  FAIBLE: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
}
const RESULTAT_BADGE: Record<string, string> = {
  CONFORME: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  ANOMALIE: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  NON_APPLICABLE: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
}
const CHECK_BADGE: Record<string, string> = {
  OK: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  KO: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  NA: 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-200',
}

export default function ControlesManager({ canDefine, canExecute, currentUserName, secondeLigneActive = true }: { canDefine: boolean; canExecute: boolean; currentUserName?: string | null; secondeLigneActive?: boolean }) {
  const { t, locale } = useTranslation()
  const c = t.controles
  // Formulaire vierge : responsable pré-rempli avec l'utilisateur courant (modifiable).
  const emptyForm = (): Form => ({ ...EMPTY, responsable: defaultResponsable(currentUserName) })
  // Saisie d'exécution vierge : date de réalisation = aujourd'hui par défaut.
  const emptyExec = (): ExecForm => ({ ...EMPTY_EXEC, dateRealisation: todayInputDate() })
  const [controles, setControles] = useState<Controle[]>([])
  const [procs, setProcs] = useState<Proc[]>([])
  const [risks, setRisks] = useState<Risk[]>([])
  const [refs, setRefs] = useState<RefLite[]>([])
  const [exigencesRef, setExigencesRef] = useState<ExigenceLite[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Form>(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [execId, setExecId] = useState<string | null>(null)
  const [exec, setExec] = useState<ExecForm>(emptyExec)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [preuves, setPreuves] = useState<Preuve[]>([])
  const [filtre, setFiltre] = useState<ControleFiltre>({ q: '', niveau: '', etat: '', referentielCode: '', actif: '' })

  // Lit les fichiers choisis en data URL (même stockage que les dérogations).
  async function chargerPreuves(files: FileList | null) {
    if (!files) return
    const lus = await Promise.all(Array.from(files).slice(0, 5).map(f => new Promise<Preuve>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve({ nom: f.name, mime: f.type, taille: f.size, dataUrl: String(reader.result) })
      reader.onerror = reject
      reader.readAsDataURL(f)
    })))
    setPreuves(p => [...p, ...lus].slice(0, 5))
  }

  const jour = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale) : '—')
  const lbl = (dict: unknown, k: string) => (dict as Record<string, string>)[k] ?? k

  async function reload() {
    const [cc, pp, rr, ff] = await Promise.all([
      fetch('/api/controles').then(x => x.ok ? x.json() : { controles: [] }),
      fetch('/api/processus').then(x => x.ok ? x.json() : { processus: [] }),
      fetch('/api/risk-items').then(x => x.ok ? x.json() : { risks: [] }),
      fetch('/api/referentiels').then(x => x.ok ? x.json() : { referentiels: [] }),
    ])
    setControles(cc.controles ?? []); setProcs(pp.processus ?? [])
    setRisks((rr.risks ?? []).map((r: Risk) => ({ id: r.id, intitule: r.intitule })))
    setRefs((ff.referentiels ?? []).map((r: RefLite) => ({ code: r.code, nom: r.nom })))
    setLoading(false)
  }
  useEffect(() => { reload() }, [])

  // Charge les exigences du référentiel choisi (pour la sélection des points couverts).
  useEffect(() => {
    if (!form.referentielCode) { setExigencesRef([]); return }
    let annule = false
    fetch(`/api/referentiels/exigences?code=${encodeURIComponent(form.referentielCode)}`)
      .then(x => x.ok ? x.json() : { exigences: [] })
      .then(d => { if (!annule) setExigencesRef(d.exigences ?? []) })
      .catch(() => { if (!annule) setExigencesRef([]) })
    return () => { annule = true }
  }, [form.referentielCode])

  function err(code: string) { return lbl(c.errors, code) }

  async function submit() {
    if (!form.intitule.trim()) { setError(err('intitule_requis')); return }
    setBusy(true); setError(null)
    const payload = {
      intitule: form.intitule, description: form.description || null,
      niveau: form.niveau, periodicite: form.periodicite,
      responsable: form.responsable || null,
      riskItemId: form.riskItemId || null, processusId: form.processusId || null,
      tailleEchantillon: form.tailleEchantillon || null,
      referentielCode: form.referentielCode || null, exigenceRefs: form.exigenceRefs,
      checklist: form.checklist,
      superviseIds: form.niveau === 'N2' ? form.superviseIds : [],
    }
    const res = await fetch(editId ? `/api/controles/${editId}` : '/api/controles', {
      method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    setForm(emptyForm()); setEditId(null); setShowForm(false); reload()
  }

  function startEdit(x: Controle) {
    setEditId(x.id); setShowForm(true); setError(null)
    setForm({
      intitule: x.intitule, description: x.description ?? '', niveau: x.niveau, periodicite: x.periodicite,
      responsable: x.responsable ?? '', riskItemId: x.riskItemId ?? '', processusId: x.processusId ?? '',
      tailleEchantillon: x.tailleEchantillon?.toString() ?? '',
      referentielCode: x.referentielCode ?? '', exigenceRefs: x.exigenceRefs ?? [],
      checklist: x.checklist ?? [], superviseIds: x.superviseIds ?? [],
    })
  }

  async function enregistrerExec(x: Controle) {
    setBusy(true); setError(null); setFlash(null)
    const res = await fetch(`/api/controles/${x.id}/executions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Si le contrôle a une checklist, le serveur DÉDUIT le résultat des points.
        resultat: exec.resultat, dateRealisation: exec.dateRealisation || null,
        constat: exec.constat || null, tailleTestee: exec.tailleTestee || null,
        anomaliesTrouvees: exec.anomaliesTrouvees || null,
        checklistResultats: exec.checklist.length ? exec.checklist : undefined,
        independant: x.niveau === 'N2' ? exec.independant : undefined,
        preuves,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    if (data.actionCreee) setFlash(c.actionGeneree)
    setExec(emptyExec()); setPreuves([]); setExecId(null); reload()
  }

  async function basculerActif(x: Controle) {
    await fetch(`/api/controles/${x.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intitule: x.intitule, actif: !x.actif }),
    })
    reload()
  }

  async function supprimer(id: string) {
    if (!confirm(c.confirmDelete)) return
    await fetch(`/api/controles/${id}`, { method: 'DELETE' }); reload()
  }

  // Import d'un socle de contrôles-types (ISO 27001 / DORA). Idempotent côté serveur.
  async function importerSocle(catalogue: string) {
    setBusy(true); setError(null); setFlash(null)
    const res = await fetch('/api/controles/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalogue }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(err(data.error ?? 'erreur')); return }
    setFlash(c.importResultat.replace('{n}', String(data.created ?? 0)).replace('{s}', String(data.skipped ?? 0)))
    reload()
  }

  const inp = 'px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'
  // Suggestions d'autocomplétion à partir des contrôles déjà saisis (org courante).
  const intituleSug = suggestionsFromValues(controles.map(x => x.intitule))
  const responsableSug = suggestionsFromValues(controles.map(x => x.responsable))
  const controlesFiltres = filtrerControles(controles, filtre)
  const filtreActif = Boolean(filtre.q || filtre.niveau || filtre.etat || filtre.referentielCode || filtre.actif)
  const enRetard = controles.filter(x => x.etatEcheance === 'EN_RETARD').length
  const dus = controles.filter(x => x.etatEcheance === 'DU').length
  const actifs = controles.filter(x => x.actif).length

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100"><FlaskConical size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" /> {c.title}</h1>
        {canDefine && !showForm && (
          <div className="flex items-center gap-1.5">
            <select value="" disabled={busy} onChange={e => { if (e.target.value) importerSocle(e.target.value); e.target.value = '' }}
              className={inp} aria-label={c.importLabel} title={c.importHint}>
              <option value="">{c.importLabel}</option>
              {CATALOGUES_CONTROLES.map(cat => <option key={cat.id} value={cat.id}>{cat.nom}</option>)}
            </select>
            <button onClick={() => { setForm(emptyForm()); setEditId(null); setShowForm(true) }} className="btn-primary text-sm">{c.newBtn}</button>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{c.subtitle}</p>

      {flash && <p className="text-xs text-ebios-600 mb-3">{flash}</p>}

      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <Tile label={c.actifs} value={actifs} />
          <Tile label={c.dus} value={dus} tone={dus > 0 ? 'amber' : undefined} />
          <Tile label={c.enRetard} value={enRetard} tone={enRetard > 0 ? 'red' : undefined} />
        </div>
      )}

      {canDefine && showForm && (
        <div className="card p-4 mb-5 space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{editId ? c.editTitle : c.addTitle}</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <input value={form.intitule} onChange={e => setForm(f => ({ ...f, intitule: e.target.value }))} placeholder={c.intitulePlaceholder} list="acra-controle-intitules" className={`${inp} w-full`} />
          <datalist id="acra-controle-intitules">{intituleSug.map(s => <option key={s} value={s} />)}</datalist>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={c.descriptionPlaceholder} rows={2} className={`${inp} w-full`} />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <label className="text-xs text-gray-500 dark:text-gray-400">{c.niveau}
              <select value={form.niveau} onChange={e => setForm(f => ({ ...f, niveau: e.target.value }))} className={`${inp} w-full mt-1`}>
                {CONTROLE_NIVEAUX.map(n => <option key={n} value={n}>{lbl(c.niveaux, n)}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">{c.periodicite}
              <select value={form.periodicite} onChange={e => setForm(f => ({ ...f, periodicite: e.target.value }))} className={`${inp} w-full mt-1`}>
                {PERIODICITES.map(p => <option key={p} value={p}>{lbl(c.periodicites, p)}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">{c.responsable}
              <input value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} list="acra-controle-responsables" className={`${inp} w-full mt-1`} />
              <datalist id="acra-controle-responsables">{responsableSug.map(s => <option key={s} value={s} />)}</datalist>
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">{c.echantillon}
              <input type="number" min="1" value={form.tailleEchantillon} onChange={e => setForm(f => ({ ...f, tailleEchantillon: e.target.value }))} className={`${inp} w-full mt-1`} />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={form.riskItemId} onChange={e => setForm(f => ({ ...f, riskItemId: e.target.value }))} className={inp}>
              <option value="">{c.riskNone}</option>
              {risks.map(r => <option key={r.id} value={r.id}>{r.intitule}</option>)}
            </select>
            <select value={form.processusId} onChange={e => setForm(f => ({ ...f, processusId: e.target.value }))} className={inp}>
              <option value="">{c.processNone}</option>
              {procs.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </div>
          {/* Rattachement à un référentiel + exigences couvertes (conformité dérivée) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={form.referentielCode} onChange={e => setForm(f => ({ ...f, referentielCode: e.target.value, exigenceRefs: [] }))} className={inp}>
              <option value="">{c.refNone}</option>
              {refs.map(r => <option key={r.code} value={r.code}>{r.nom}</option>)}
            </select>
            {form.referentielCode && (
              <div className="sm:row-span-1">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{c.exigencesCouvertes} ({form.exigenceRefs.length})</div>
                <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                  {exigencesRef.length === 0
                    ? <div className="px-3 py-2 text-xs text-gray-400">{c.exigencesVides}</div>
                    : exigencesRef.map(ex => (
                      <label key={ex.ref} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                        <input type="checkbox" checked={form.exigenceRefs.includes(ex.ref)}
                          onChange={() => setForm(f => ({ ...f, exigenceRefs: f.exigenceRefs.includes(ex.ref) ? f.exigenceRefs.filter(r => r !== ex.ref) : [...f.exigenceRefs, ex.ref] }))} />
                        <span className="font-mono text-gray-400 w-14 shrink-0">{ex.ref}</span>
                        <span className="text-gray-700 dark:text-gray-200 truncate" title={ex.nom}>{ex.nom}</span>
                      </label>
                    ))}
                </div>
              </div>
            )}
          </div>
          {/* Contrôle du contrôle : un contrôle N2 supervise des contrôles N1 (2ᵉ ligne
              qui vérifie la bonne exécution et l'efficacité de la 1ʳᵉ ligne).
              Masqué en mode « ligne unique » (2ᵉ ligne désactivée). */}
          {secondeLigneActive && form.niveau === 'N2' && (
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{c.supervise} <span className="text-gray-400">— {c.superviseHint}</span> ({form.superviseIds.length})</div>
              {controles.filter(x => x.niveau === 'N1' && x.id !== editId).length === 0
                ? <div className="text-xs text-gray-400">{c.superviseVide}</div>
                : (
                  <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                    {controles.filter(x => x.niveau === 'N1' && x.id !== editId).map(n1 => (
                      <label key={n1.id} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                        <input type="checkbox" checked={form.superviseIds.includes(n1.id)}
                          onChange={() => setForm(f => ({ ...f, superviseIds: f.superviseIds.includes(n1.id) ? f.superviseIds.filter(i => i !== n1.id) : [...f.superviseIds, n1.id] }))} />
                        <span className="text-gray-700 dark:text-gray-200 truncate" title={n1.intitule}>{n1.intitule}</span>
                        {n1.efficacite.efficacite && <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium ${EFF_BADGE[n1.efficacite.efficacite]}`}>{n1.efficacite.tauxConformite}%</span>}
                      </label>
                    ))}
                  </div>
                )}
            </div>
          )}
          {/* Checklist : points à vérifier (facultatif). À l'exécution, chacun est coté
              OK/KO/NA et le résultat global se déduit. */}
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{c.checklist} <span className="text-gray-400">— {c.checklistHint}</span></div>
            <div className="space-y-1.5">
              {form.checklist.map((point, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
                  <input value={point} onChange={e => setForm(f => ({ ...f, checklist: f.checklist.map((p, j) => j === i ? e.target.value : p) }))} placeholder={c.checklistPlaceholder} className={`${inp} flex-1`} />
                  <button type="button" onClick={() => setForm(f => ({ ...f, checklist: f.checklist.filter((_, j) => j !== i) }))} className="text-xs text-red-500 hover:underline">{c.retirer}</button>
                </div>
              ))}
              <button type="button" onClick={() => setForm(f => ({ ...f, checklist: [...f.checklist, ''] }))} className="text-xs text-ebios-600 hover:underline">+ {c.checklistAdd}</button>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{editId ? c.save : c.add}</button>
            <button onClick={() => { setShowForm(false); setEditId(null); setError(null) }} className="text-sm text-gray-500 hover:text-gray-700">{c.cancel}</button>
          </div>
        </div>
      )}

      {/* Barre de filtres : recherche + facettes (niveau, échéance, référentiel, actif) */}
      {!loading && controles.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <input value={filtre.q ?? ''} onChange={e => setFiltre(f => ({ ...f, q: e.target.value }))} placeholder={c.filtreRecherche} className={`${inp} min-w-[200px]`} />
          <select value={filtre.niveau ?? ''} onChange={e => setFiltre(f => ({ ...f, niveau: e.target.value }))} className={inp} aria-label={c.niveau}>
            <option value="">{c.filtreNiveauTous}</option>
            {CONTROLE_NIVEAUX.map(n => <option key={n} value={n}>{lbl(c.niveaux, n)}</option>)}
          </select>
          <select value={filtre.etat ?? ''} onChange={e => setFiltre(f => ({ ...f, etat: e.target.value }))} className={inp} aria-label={c.colEcheance}>
            <option value="">{c.filtreEtatTous}</option>
            {['A_VENIR', 'DU', 'EN_RETARD'].map(s => <option key={s} value={s}>{lbl(c.etats, s)}</option>)}
          </select>
          {refs.length > 0 && (
            <select value={filtre.referentielCode ?? ''} onChange={e => setFiltre(f => ({ ...f, referentielCode: e.target.value }))} className={inp} aria-label={c.refNone}>
              <option value="">{c.filtreRefTous}</option>
              {refs.map(r => <option key={r.code} value={r.code}>{r.nom}</option>)}
            </select>
          )}
          <select value={filtre.actif ?? ''} onChange={e => setFiltre(f => ({ ...f, actif: e.target.value }))} className={inp} aria-label={c.filtreActifTous}>
            <option value="">{c.filtreActifTous}</option>
            <option value="true">{c.filtreActifsSeuls}</option>
            <option value="false">{c.filtreInactifsSeuls}</option>
          </select>
          {filtreActif && (
            <>
              <span className="text-xs text-gray-400">{c.filtreResultat.replace('{n}', String(controlesFiltres.length)).replace('{total}', String(controles.length))}</span>
              <button onClick={() => setFiltre({ q: '', niveau: '', etat: '', referentielCode: '', actif: '' })} className="text-xs text-ebios-600 hover:underline">✕ {c.filtreEffacer}</button>
            </>
          )}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3">{c.colControle}</th>
              <th className="px-4 py-3">{c.colRattachement}</th>
              <th className="px-4 py-3">{c.colPeriodicite}</th>
              <th className="px-4 py-3">{c.colEcheance}</th>
              <th className="px-4 py-3">{c.colEfficacite}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="px-4 py-6 text-gray-400">…</td></tr>
              : controles.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 italic">{c.empty}</td></tr>
              : controlesFiltres.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 italic">{c.filtreAucun}</td></tr>
              : controlesFiltres.map(x => (
                <Fragment key={x.id}>
                  <tr className={`border-b border-gray-100 dark:border-gray-800 align-top ${x.actif ? '' : 'opacity-50'}`}>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {x.intitule}
                      <span className="block text-xs text-gray-400">
                        {lbl(c.niveaux, x.niveau)}{x.responsable && ` · ${x.responsable}`}
                        {x.tailleEchantillon != null && ` · n=${x.tailleEchantillon}`}
                        {!x.actif && ` · ${c.inactif}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {x.riskItemIntitule ?? '—'}
                      {x.processusNom && <span className="block">{x.processusNom}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{lbl(c.periodicites, x.periodicite)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {x.etatEcheance ? (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${ECHEANCE_BADGE[x.etatEcheance]}`}>
                          {lbl(c.etats, x.etatEcheance)}
                        </span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                      <span className="block text-[10px] text-gray-400 mt-0.5">{jour(x.prochaineEcheance)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {x.efficacite.efficacite ? (
                        <button onClick={() => setExpandedId(id => id === x.id ? null : x.id)} className="inline-flex items-center gap-1">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${EFF_BADGE[x.efficacite.efficacite]}`}>
                            {x.efficacite.tauxConformite}% · {lbl(c.efficacites, x.efficacite.efficacite)}
                          </span>
                          <span className="text-gray-400 text-xs">{expandedId === x.id ? '▾' : '▸'}</span>
                        </button>
                      ) : <span className="text-xs text-gray-400">{c.jamaisExecute}</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {canExecute && x.actif && (
                        <button onClick={() => { setExecId(x.id); setExec({ ...emptyExec(), checklist: (x.checklist ?? []).map(label => ({ label, statut: 'OK' as ChecklistStatut, commentaire: '' })) }); setPreuves([]); setError(null) }} className="text-xs text-ebios-600 hover:underline mr-2">{c.execute}</button>
                      )}
                      {canDefine && <>
                        <button onClick={() => startEdit(x)} className="text-xs text-ebios-600 hover:underline mr-2">{c.edit}</button>
                        <button onClick={() => basculerActif(x)} className="text-xs text-gray-500 hover:underline mr-2">{x.actif ? c.desactiver : c.activer}</button>
                        <button onClick={() => supprimer(x.id)} className="text-xs text-red-500 hover:underline">{c.delete}</button>
                      </>}
                    </td>
                  </tr>

                  {/* Historique + suggestion de vraisemblance issue de l'efficacité */}
                  {expandedId === x.id && (
                    <tr className="bg-gray-50/60 dark:bg-gray-800/30">
                      <td colSpan={6} className="px-4 py-4">
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                          {c.historique} — {c.resume
                            .replace('{e}', String(x.efficacite.evaluees))
                            .replace('{c}', String(x.efficacite.conformes))
                            .replace('{a}', String(x.efficacite.anomalies))}
                          {x.efficacite.vraisemblanceSuggeree != null && x.riskItemIntitule && (
                            <span className="ml-1 text-ebios-600">
                              · {c.suggestion.replace('{v}', String(x.efficacite.vraisemblanceSuggeree))}
                            </span>
                          )}
                        </p>
                        {/* Contrôle du contrôle : contrôles N1 supervisés + leur efficacité */}
                        {x.superviseIds?.length > 0 && (
                          <div className="mb-2 text-xs">
                            <span className="text-gray-500 dark:text-gray-400">{c.superviseListe} : </span>
                            {x.superviseIds.map(id => {
                              const n1 = controles.find(ct => ct.id === id)
                              if (!n1) return null
                              return (
                                <span key={id} className="inline-flex items-center gap-1 mr-2">
                                  <span className="text-gray-700 dark:text-gray-200">{n1.intitule}</span>
                                  {n1.efficacite.efficacite && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${EFF_BADGE[n1.efficacite.efficacite]}`}>{n1.efficacite.tauxConformite}%</span>}
                                </span>
                              )
                            })}
                          </div>
                        )}
                        <ul className="space-y-1">
                          {x.executions.map(e => (
                            <li key={e.id} className="flex items-center gap-2 text-xs">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${RESULTAT_BADGE[e.resultat]}`}>{lbl(c.resultats, e.resultat)}</span>
                              <span className="text-gray-400">{jour(e.dateRealisation)}</span>
                              {e.independant === true && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-ebios-100 text-ebios-700 dark:bg-ebios-500/15 dark:text-ebios-300" title={c.independantHint}>{c.independantBadge}</span>}
                              {e.constat && <span className="text-gray-600 dark:text-gray-300 truncate">{e.constat}</span>}
                              {e.preuves?.length > 0 && <span className="text-gray-400"><Paperclip size={15} className="inline align-[-0.15em] mr-1.5" aria-hidden="true" /> {e.preuves.length}</span>}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}

                  {/* Saisie d'une exécution */}
                  {canExecute && execId === x.id && (
                    <tr className="bg-ebios-50/40 dark:bg-ebios-500/5">
                      <td colSpan={6} className="px-4 py-4 space-y-2">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{c.executeTitle} — {x.intitule}</p>
                        {error && <p className="text-xs text-red-600">{error}</p>}
                        {exec.checklist.length > 0 ? (
                          // Cotation par point : le résultat global est déduit (aperçu affiché).
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-end gap-3">
                              <label className="text-xs text-gray-500 dark:text-gray-400">{c.dateRealisation}
                                <input type="date" value={exec.dateRealisation} onChange={e => setExec(f => ({ ...f, dateRealisation: e.target.value }))} className={`${inp} block mt-1`} />
                              </label>
                              {(() => { const d = deduireResultatChecklist(exec.checklist); return d && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 pb-1.5">{c.resultatDeduit} :{' '}
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${RESULTAT_BADGE[d.resultat]}`}>{lbl(c.resultats, d.resultat)}</span>
                                </span>
                              )})()}
                            </div>
                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                              {exec.checklist.map((pt, i) => (
                                <div key={i} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                                  <span className="text-xs text-gray-700 dark:text-gray-200 flex-1 min-w-[160px]" title={pt.label}>{pt.label}</span>
                                  <div className="flex gap-1">
                                    {(['OK', 'KO', 'NA'] as ChecklistStatut[]).map(st => (
                                      <button key={st} type="button"
                                        onClick={() => setExec(f => ({ ...f, checklist: f.checklist.map((p, j) => j === i ? { ...p, statut: st } : p) }))}
                                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${pt.statut === st ? CHECK_BADGE[st] : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'}`}>
                                        {lbl(c.checklistStatuts, st)}
                                      </button>
                                    ))}
                                  </div>
                                  <input value={pt.commentaire ?? ''} onChange={e => setExec(f => ({ ...f, checklist: f.checklist.map((p, j) => j === i ? { ...p, commentaire: e.target.value } : p) }))} placeholder={c.checklistComment} className={`${inp} text-xs flex-1 min-w-[140px]`} />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2 items-end">
                            <label className="text-xs text-gray-500 dark:text-gray-400">{c.resultat}
                              <select value={exec.resultat} onChange={e => setExec(f => ({ ...f, resultat: e.target.value }))} className={`${inp} block mt-1`}>
                                {RESULTATS.map(rr => <option key={rr} value={rr}>{lbl(c.resultats, rr)}</option>)}
                              </select>
                            </label>
                            <label className="text-xs text-gray-500 dark:text-gray-400">{c.dateRealisation}
                              <input type="date" value={exec.dateRealisation} onChange={e => setExec(f => ({ ...f, dateRealisation: e.target.value }))} className={`${inp} block mt-1`} />
                            </label>
                            <label className="text-xs text-gray-500 dark:text-gray-400">{c.tailleTestee}
                              <input type="number" min="0" value={exec.tailleTestee} onChange={e => setExec(f => ({ ...f, tailleTestee: e.target.value }))} className={`${inp} block mt-1 w-24`} />
                            </label>
                            <label className="text-xs text-gray-500 dark:text-gray-400">{c.anomaliesTrouvees}
                              <input type="number" min="0" value={exec.anomaliesTrouvees} onChange={e => setExec(f => ({ ...f, anomaliesTrouvees: e.target.value }))} className={`${inp} block mt-1 w-24`} />
                            </label>
                          </div>
                        )}
                        <textarea value={exec.constat} onChange={e => setExec(f => ({ ...f, constat: e.target.value }))} placeholder={c.constatPlaceholder} rows={2} className={`${inp} w-full`} />
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400">{c.preuves}
                            <input type="file" multiple onChange={e => chargerPreuves(e.target.files)} className={`${inp} block mt-1 w-full`} />
                          </label>
                          {preuves.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {preuves.map((p, i) => (
                                <li key={i} className="text-xs text-gray-500 flex items-center gap-2">
                                  <span className="truncate">{p.nom}</span>
                                  <button onClick={() => setPreuves(list => list.filter((_, j) => j !== i))} className="text-red-500 hover:underline">{c.retirer}</button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        {/* Indépendance de l'exécutant (séparation des fonctions) — contrôle N2.
                            Masqué en mode « ligne unique » (2ᵉ ligne désactivée). */}
                        {secondeLigneActive && x.niveau === 'N2' && (
                          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                            <input type="checkbox" checked={exec.independant} onChange={e => setExec(f => ({ ...f, independant: e.target.checked }))} />
                            {c.independantLabel}
                          </label>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => enregistrerExec(x)} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{c.save}</button>
                          <button onClick={() => { setExecId(null); setError(null) }} className="text-sm text-gray-500 hover:text-gray-700">{c.cancel}</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: 'amber' | 'red' }) {
  const color = tone === 'red' ? 'text-red-600 dark:text-red-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-gray-100'
  return (
    <div className="card p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
