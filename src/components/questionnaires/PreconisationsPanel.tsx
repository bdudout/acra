'use client'

// ─── Préconisations : suivi par le métier (plan d'action, acceptation du risque, réalisation,
// report) et par la 2ᵉ ligne (création, vérification, réouverture, décision sur les reports).
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

type Preco = {
  id: string; intitule: string; recommandation: string | null; criticite: number | null; statut: 'OUVERT' | 'EN_COURS' | 'RESOLU' | 'VERIFIE' | 'ACCEPTE'
  responsableAction: string | null; responsableId: string | null; echeance: string | null; referentielCode: string | null; exigenceRef: string | null; riskItemId: string | null
  reponseId: string | null; acceptationJustification: string | null; reports: { nouvelle: string; motif: string; statut: string }[]
  plansAction: { id: string; titre: string; statut: string }[]
}
type Action = { id: string; type: 'plan' | 'accepter' | 'report' | 'verifier' | 'reouvrir' } | null

export default function PreconisationsPanel({ conformiteActive, focusId }: { conformiteActive: boolean; focusId: string | null }) {
  const { t, locale } = useTranslation()
  const q = t.questionnaires
  const [data, setData] = useState<{ preconisations: Preco[]; canDefine: boolean; responsables?: { id: string; name: string | null; email: string }[] } | null>(null)
  const [action, setAction] = useState<Action>(null)
  const [champs, setChamps] = useState({ titre: '', echeance: '', texte: '', lierConformite: false, lierRisque: false })
  const [creation, setCreation] = useState(false)
  const [nouvelle, setNouvelle] = useState({ intitule: '', recommandation: '', criticite: '', echeance: '', responsableId: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Lecture sans effet de bord : l'effet initial applique le résultat dans un rappel (pas de setState synchrone).
  async function lire() {
    const res = await fetch('/api/preconisations')
    return res.ok ? await res.json() : { preconisations: [], canDefine: false }
  }
  async function charger() { setData(await lire()) }
  useEffect(() => { void lire().then(setData) }, [])

  async function appel(url: string, body: unknown) {
    setBusy(true); setError(null)
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { setError(q.error); return false }
      setAction(null); setChamps({ titre: '', echeance: '', texte: '', lierConformite: false, lierRisque: false }); await charger(); return true
    } finally { setBusy(false) }
  }

  async function creer() {
    if (await appel('/api/preconisations', { ...nouvelle, criticite: nouvelle.criticite || null, echeance: nouvelle.echeance || null, responsableId: nouvelle.responsableId || null })) {
      setCreation(false); setNouvelle({ intitule: '', recommandation: '', criticite: '', echeance: '', responsableId: '' })
    }
  }

  const inp = 'mt-1 w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'
  const lbl = 'block text-xs text-gray-600 dark:text-gray-300'
  const jour = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale) : q.none)
  const ouverte = (p: Preco) => p.statut === 'OUVERT' || p.statut === 'EN_COURS'

  return <section className="space-y-3">
    {data?.canDefine && !creation && <button type="button" className="btn-primary text-sm" onClick={() => setCreation(true)}>{q.nouvellePreco}</button>}
    {creation && <div className="card space-y-2 p-4">
      <label className={lbl}>{q.intitule}<input className={inp} value={nouvelle.intitule} onChange={e => setNouvelle({ ...nouvelle, intitule: e.target.value })} /></label>
      <label className={lbl}>{q.recommandation}<textarea className={inp} rows={2} value={nouvelle.recommandation} onChange={e => setNouvelle({ ...nouvelle, recommandation: e.target.value })} /></label>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className={lbl}>{q.responsable}<select className={inp} value={nouvelle.responsableId} onChange={e => setNouvelle({ ...nouvelle, responsableId: e.target.value })}>
          <option value="">{q.none}</option>{(data?.responsables ?? []).map(u => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}</select></label>
        <label className={lbl}>{q.criticite}<select className={inp} value={nouvelle.criticite} onChange={e => setNouvelle({ ...nouvelle, criticite: e.target.value })}><option value="">{q.none}</option>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
        <label className={lbl}>{q.echeance}<input type="date" className={inp} value={nouvelle.echeance} onChange={e => setNouvelle({ ...nouvelle, echeance: e.target.value })} /></label>
      </div>
      <div className="flex gap-2"><button type="button" className="btn-primary text-sm" disabled={busy || !nouvelle.intitule.trim()} onClick={() => void creer()}>{q.creer}</button>
        <button type="button" className="btn-secondary text-sm" onClick={() => setCreation(false)}>{q.cancel}</button></div>
    </div>}
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    {data === null ? <p className="text-sm text-gray-500">{q.loading}</p>
      : data.preconisations.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">{q.precosVide}</p>
      : data.preconisations.map(p => {
        const enAttente = p.reports.findIndex(r => r.statut === 'DEMANDE')
        return <div key={p.id} id={`preco-${p.id}`} className={`card space-y-2 p-3 ${focusId === p.id ? 'ring-2 ring-ebios-400' : ''}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.intitule}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{q.statutsPreco[p.statut]} · {q.responsable} : {p.responsableAction ?? q.none} · {q.echeance} : {jour(p.echeance)}{p.criticite ? ` · ${q.criticite} : ${p.criticite}` : ''}</p>
              {p.referentielCode && p.exigenceRef && <p className="text-xs text-gray-500 dark:text-gray-400">{q.exigence.replace('{code}', p.referentielCode).replace('{ref}', p.exigenceRef)}</p>}
              {p.recommandation && <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">{p.recommandation}</p>}
              {p.acceptationJustification && <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{q.justification} : {p.acceptationJustification}</p>}
              {p.plansAction.length > 0 && <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{q.plansLies} : {p.plansAction.map(pa => pa.titre).join(', ')}</p>}
              {enAttente >= 0 && <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">{q.reportDemande.replace('{date}', jour(p.reports[enAttente].nouvelle)).replace('{motif}', p.reports[enAttente].motif)}</p>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ouverte(p) && <>
                <button type="button" className="btn-secondary text-xs" onClick={() => setAction({ id: p.id, type: 'plan' })}>{q.planAction}</button>
                <button type="button" className="btn-secondary text-xs" onClick={() => setAction({ id: p.id, type: 'accepter' })}>{q.accepterRisque}</button>
                <button type="button" className="btn-secondary text-xs" onClick={() => void appel(`/api/preconisations/${p.id}/suivi`, { action: 'DECLARER_REALISE' })}>{q.declarerRealise}</button>
                {enAttente < 0 && <button type="button" className="btn-secondary text-xs" onClick={() => setAction({ id: p.id, type: 'report' })}>{q.demanderReport}</button>}
              </>}
              {data.canDefine && p.statut === 'RESOLU' && <button type="button" className="btn-primary text-xs" onClick={() => setAction({ id: p.id, type: 'verifier' })}>{q.verifier}</button>}
              {data.canDefine && (p.statut === 'RESOLU' || p.statut === 'VERIFIE') && <button type="button" className="btn-secondary text-xs" onClick={() => setAction({ id: p.id, type: 'reouvrir' })}>{q.reouvrir}</button>}
              {data.canDefine && enAttente >= 0 && <>
                <button type="button" className="btn-secondary text-xs" onClick={() => void appel(`/api/preconisations/${p.id}/suivi`, { action: 'DECIDER_REPORT', index: enAttente, decision: 'APPROUVE' })}>{q.approuver}</button>
                <button type="button" className="btn-secondary text-xs" onClick={() => void appel(`/api/preconisations/${p.id}/suivi`, { action: 'DECIDER_REPORT', index: enAttente, decision: 'REFUSE' })}>{q.refuser}</button>
              </>}
            </div>
          </div>
          {action?.id === p.id && <div className="space-y-2 rounded-sm border border-gray-200 p-2 dark:border-gray-700">
            {action.type === 'plan' && <>
              <label className={lbl}>{q.intitule}<input className={inp} placeholder={p.intitule} value={champs.titre} onChange={e => setChamps({ ...champs, titre: e.target.value })} /></label>
              <label className={lbl}>{q.echeance}<input type="date" className={inp} value={champs.echeance} onChange={e => setChamps({ ...champs, echeance: e.target.value })} /></label>
              {conformiteActive && p.referentielCode && p.exigenceRef && <label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={champs.lierConformite} onChange={e => setChamps({ ...champs, lierConformite: e.target.checked })} />{q.lierConformite}</label>}
              {p.riskItemId && <label className="ml-4 inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={champs.lierRisque} onChange={e => setChamps({ ...champs, lierRisque: e.target.checked })} />{q.lierRisque}</label>}
            </>}
            {action.type === 'accepter' && <>
              <label className={lbl}>{q.justification}<textarea className={inp} rows={2} value={champs.texte} onChange={e => setChamps({ ...champs, texte: e.target.value })} /></label>
              {conformiteActive && p.referentielCode && p.exigenceRef && <label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={champs.lierConformite} onChange={e => setChamps({ ...champs, lierConformite: e.target.checked })} />{q.lierConformiteAcceptation}</label>}
            </>}
            {action.type === 'report' && <>
              <label className={lbl}>{q.nouvelleEcheance}<input type="date" className={inp} value={champs.echeance} onChange={e => setChamps({ ...champs, echeance: e.target.value })} /></label>
              <label className={lbl}>{q.motif}<input className={inp} value={champs.texte} onChange={e => setChamps({ ...champs, texte: e.target.value })} /></label>
            </>}
            {(action.type === 'verifier' || action.type === 'reouvrir') && <label className={lbl}>{q.commentaire}<input className={inp} value={champs.texte} onChange={e => setChamps({ ...champs, texte: e.target.value })} /></label>}
            <div className="flex gap-2">
              <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void (
                action.type === 'plan' ? appel(`/api/preconisations/${p.id}/plan-action`, { titre: champs.titre || undefined, echeance: champs.echeance || undefined, lierConformite: champs.lierConformite, lierRisque: champs.lierRisque })
                : action.type === 'accepter' ? appel(`/api/preconisations/${p.id}/suivi`, { action: 'ACCEPTER_RISQUE', justification: champs.texte, lierConformite: champs.lierConformite })
                : action.type === 'report' ? appel(`/api/preconisations/${p.id}/suivi`, { action: 'DEMANDER_REPORT', nouvelleEcheance: champs.echeance, motif: champs.texte })
                : appel(`/api/preconisations/${p.id}/suivi`, { action: action.type === 'verifier' ? 'VERIFIER' : 'REOUVRIR', commentaire: champs.texte }))}>{q.save}</button>
              <button type="button" className="btn-secondary text-xs" onClick={() => setAction(null)}>{q.cancel}</button>
            </div>
          </div>}
        </div>
      })}
  </section>
}
