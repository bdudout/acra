'use client'

// ─── Évaluation d'un usage de service tiers (lot T1) ──────────────────────────
// Mêmes principes que l'atelier 3 d'EBIOS RM : dépendance, pénétration, maturité, confiance sur les échelles de
// l'organisation ; menace = (dépendance × pénétration) / (maturité × confiance) et zone, pour la cotation ACTUELLE et la
// CIBLE (résiduelle) ; clauses contractuelles types ; traitements RGPD et risques d'externalisation rattachés.
// Évalue / soumet : propriétaire du risque ou analyste ; valide / renvoie : RSSI. API : /api/tier-registry/usages/[id]/evaluation.
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { CRITERES_ECOSYSTEME, type CritereEcosysteme, type EchellesEcosysteme } from '@/lib/ecosystem-echelles'
import { CONTRACTUAL_CLAUSE_KEYS } from '@/lib/ecosystem-contractual-clauses'
import { coterEvaluation, type Cotation } from '@/lib/tier-evaluation'

interface Reponse {
  evaluation: { statut: 'BROUILLON' | 'SOUMISE' | 'VALIDEE'; actuelle: Cotation; cible: Cotation | null; clauses: string[]; traitementIds: string[]; risqueIds: string[]; justification: string } | null
  prochaineEvaluation: string | null
  droits: { peutEvaluer: boolean; peutValider: boolean }
  echelles: EchellesEcosysteme
  options: { traitements: { id: string; nom: string }[]; risques: { id: string; intitule: string }[] }
}
const VIDE: Cotation = { dependance: null, penetration: null, maturite: null, confiance: null }
const ZONE_BADGE: Record<string, string> = {
  danger: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200', controle: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200', veille: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-200',
}

export default function EvaluationUsagePanel({ usageId, usageNom, onChange }: { usageId: string; usageNom: string; onChange: () => void }) {
  const { t, locale } = useTranslation()
  const l = t.tierEval
  const a3 = t.workshop.a3
  const critLabel: Record<CritereEcosysteme, string> = { dependance: a3.ppDependanceLabel, penetration: a3.ppPenetrationLabel, maturite: a3.ppMaturiteLabel, confiance: a3.ppConfianceLabel }
  const zoneLabel: Record<string, string> = { danger: a3.radar.zoneDanger, controle: a3.radar.zoneControle, veille: a3.radar.zoneVeille }
  const [data, setData] = useState<Reponse | null>(null)
  const [actuelle, setActuelle] = useState<Cotation>(VIDE)
  const [cible, setCible] = useState<Cotation>(VIDE)
  const [clauses, setClauses] = useState<string[]>([])
  const [traitementIds, setTraitementIds] = useState<string[]>([])
  const [risqueIds, setRisqueIds] = useState<string[]>([])
  const [justification, setJustification] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const charger = useCallback(async () => {
    const r = await fetch(`/api/tier-registry/usages/${usageId}/evaluation`, { cache: 'no-store' }).catch(() => null)
    if (!r?.ok) return
    const j = (await r.json()) as Reponse
    setData(j)
    const e = j.evaluation
    setActuelle(e?.actuelle ?? VIDE); setCible(e?.cible ?? VIDE); setClauses(e?.clauses ?? []); setTraitementIds(e?.traitementIds ?? []); setRisqueIds(e?.risqueIds ?? []); setJustification(e?.justification ?? '')
  }, [usageId])
  useEffect(() => { void charger() }, [charger])

  if (!data) return null
  const lecture = !data.droits.peutEvaluer
  const statut = data.evaluation?.statut ?? null
  const cote = coterEvaluation({ actuelle, cible }, data.echelles)
  const bascule = (liste: string[], set: (v: string[]) => void, id: string) => set(liste.includes(id) ? liste.filter(x => x !== id) : [...liste, id])
  const erreur = (code?: string) => (l.erreurs as Record<string, string>)[code ?? ''] ?? l.erreurs.defaut

  async function appel(method: 'PUT' | 'POST', body: object, okTexte: string) {
    setBusy(true); setMsg(null)
    const r = await fetch(`/api/tier-registry/usages/${usageId}/evaluation`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    setBusy(false)
    if (!r?.ok) { const j = r ? ((await r.json().catch(() => ({}))) as { error?: string }) : {}; setMsg({ ok: false, texte: erreur(j.error) }); return }
    setMsg({ ok: true, texte: okTexte }); await charger(); onChange()
  }
  const enregistrer = () => appel('PUT', { actuelle, cible: Object.values(cible).some(v => v !== null) ? cible : null, clauses, traitementIds, risqueIds, justification }, l.enregistre)

  const niveauTexte = (n: { menace: number; zone: string } | null) => (n ? `${n.menace.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — ${zoneLabel[n.zone]}` : l.nonCote)
  const colonne = (titre: string, valeur: Cotation, set: (c: Cotation) => void, cle: 'actuelle' | 'cible') => (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{titre}</p>
      {CRITERES_ECOSYSTEME.map(c => (
        <label key={c} className="block text-[11px] text-gray-600 dark:text-gray-300">{critLabel[c]}
          <select aria-label={`${critLabel[c]} — ${titre.toLowerCase()}`} disabled={lecture} value={valeur[c] ?? ''} onChange={e => set({ ...valeur, [c]: e.target.value ? Number(e.target.value) : null })}
            className="mt-0.5 block w-full rounded-sm border border-gray-300 bg-white px-2 py-1 text-xs dark:bg-gray-900 dark:border-gray-600">
            <option value="">—</option>
            {data.echelles[c].niveaux.map(n => <option key={n.valeur} value={n.valeur}>{n.valeur} — {n.nom}</option>)}
          </select>
        </label>
      ))}
      <p data-testid={`menace-${cle}`} className="text-xs">{l.menace} : {(() => { const n = cote[cle]; return n ? <span className={`rounded-full px-2 py-0.5 ${ZONE_BADGE[n.zone]}`}>{niveauTexte(n)}</span> : <span className="text-gray-400">{l.nonCote}</span> })()}</p>
    </div>
  )

  return (
    <section className="mt-2 rounded-sm border border-ebios-200 dark:border-ebios-700 bg-ebios-50/40 dark:bg-ebios-500/5 p-3 space-y-3" aria-label={l.titre.replace('{nom}', usageNom)}>
      <div className="flex flex-wrap items-center gap-2">
        <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{l.titre.replace('{nom}', usageNom)}</h5>
        {statut && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700 dark:bg-gray-700 dark:text-gray-200">{l.statuts[statut]}</span>}
        {data.prochaineEvaluation && <span className="text-[11px] text-gray-500">{l.prochaine.replace('{date}', new Date(data.prochaineEvaluation).toLocaleDateString(locale, { timeZone: 'UTC' }))}</span>}
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">{l.aide}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {colonne(l.actuelle, actuelle, setActuelle, 'actuelle')}
        {colonne(l.cible, cible, setCible, 'cible')}
      </div>
      <fieldset>
        <legend className="text-xs font-semibold text-gray-700 dark:text-gray-200">{l.clauses}</legend>
        <div className="mt-1 grid gap-1 sm:grid-cols-2">
          {CONTRACTUAL_CLAUSE_KEYS.map(k => { const lab = (a3.measClauses as Record<string, string>)[k]; return (
            <label key={k} className="inline-flex items-center gap-1.5 text-[11px] text-gray-700 dark:text-gray-200"><input type="checkbox" aria-label={lab} disabled={lecture} checked={clauses.includes(k)} onChange={() => bascule(clauses, setClauses, k)} />{lab}</label>
          ) })}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset>
          <legend className="text-xs font-semibold text-gray-700 dark:text-gray-200">{l.traitements}</legend>
          {data.options.traitements.length === 0 ? <p className="text-[11px] text-gray-400">{l.aucun}</p> : (
            <div className="mt-1 max-h-32 overflow-y-auto space-y-0.5">{data.options.traitements.map(x => (
              <label key={x.id} className="flex items-center gap-1.5 text-[11px] text-gray-700 dark:text-gray-200"><input type="checkbox" aria-label={x.nom} disabled={lecture} checked={traitementIds.includes(x.id)} onChange={() => bascule(traitementIds, setTraitementIds, x.id)} />{x.nom}</label>
            ))}</div>
          )}
        </fieldset>
        <fieldset>
          <legend className="text-xs font-semibold text-gray-700 dark:text-gray-200">{l.risques}</legend>
          <p className="text-[11px] text-gray-400">{l.risquesAide}</p>
          {data.options.risques.length === 0 ? <p className="text-[11px] text-gray-400">{l.aucun}</p> : (
            <div className="mt-1 max-h-32 overflow-y-auto space-y-0.5">{data.options.risques.map(x => (
              <label key={x.id} className="flex items-center gap-1.5 text-[11px] text-gray-700 dark:text-gray-200"><input type="checkbox" aria-label={x.intitule} disabled={lecture} checked={risqueIds.includes(x.id)} onChange={() => bascule(risqueIds, setRisqueIds, x.id)} />{x.intitule}</label>
            ))}</div>
          )}
        </fieldset>
      </div>
      <label className="block text-xs text-gray-600 dark:text-gray-300">{l.justification}
        <textarea aria-label={l.justification} disabled={lecture} rows={2} maxLength={4000} value={justification} onChange={e => setJustification(e.target.value)} className="mt-1 block w-full rounded-sm border border-gray-300 bg-white px-2 py-1 text-xs dark:bg-gray-900 dark:border-gray-600" />
      </label>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-xs ${msg.ok ? 'text-green-700 dark:text-green-300' : 'text-red-600'}`}>{msg.texte}</p>}
      <div className="flex flex-wrap gap-2">
        {data.droits.peutEvaluer && <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => void enregistrer()}>{l.enregistrer}</button>}
        {data.droits.peutEvaluer && statut === 'BROUILLON' && <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void appel('POST', { action: 'SOUMETTRE' }, l.soumise)}>{l.soumettre}</button>}
        {data.droits.peutValider && statut === 'SOUMISE' && <>
          <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void appel('POST', { action: 'VALIDER' }, l.validee)}>{l.valider}</button>
          <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => void appel('POST', { action: 'RENVOYER' }, l.renvoyee)}>{l.renvoyer}</button>
        </>}
      </div>
    </section>
  )
}
