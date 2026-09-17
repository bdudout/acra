'use client'

// Popover de traitement RÉEL d'un écart de conformité (plan d'action, dérogation,
// acceptation de risque) au niveau du socle d'organisation.
//
// Un seul flux : on recherche en autocomplétion un traitement EXISTANT du même
// type (plan d'action / dérogation) ; le sélectionner préremplit les champs et
// bascule le bouton « Créer » en « Mettre à jour » (le libellé d'un traitement
// existant n'est PAS modifiable ici). Sans sélection, on crée un traitement neuf
// couvrant l'exigence. Un traitement peut couvrir plusieurs exigences (`refs`).

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { entryTagForType, type TraitementType } from '@/lib/conformite-traitement'
import { ACTION_PRIORITES } from '@/lib/risk-action'
import type { ConformiteTraitement as EntryTag } from '@/lib/conformite'

export interface ExistingTraitement {
  id: string
  type: string
  intitule: string
  refs: string[]
  description?: string | null
  responsable?: string | null
  echeance?: string | null
  statut?: string
  niveauRisqueMaintenu?: boolean
  niveauRisque?: string | null
}

// Action réelle du plan d'action unifié (PlanAction) — candidate au rattachement
// d'un contrôle de conformité (ajout d'un lien CONFORMITE), pour un type PLAN_ACTION.
interface PlanActionLite {
  id: string
  titre: string
  porteur?: string | null
  echeance?: string | null
  statut?: string
  liens?: { type: string; targetId: string; ref?: string | null }[]
}

export default function TraitementPopover({ orgId, referentiel, entite, controlRef, controlNom, type, existing, onApplied, onClose }: {
  orgId: string
  referentiel: string
  entite: string
  controlRef: string
  controlNom: string
  type: TraitementType
  existing: ExistingTraitement[]
  onApplied: (tag: EntryTag) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const u = t.conformite.traitementUI
  const typeLabel = (t.conformite.traitements as Record<string, string>)[entryTagForType(type)] ?? type
  const defaultTitle = `${typeLabel} — ${controlRef}`
  // Placeholder du champ de recherche/intitulé, adapté au type de traitement.
  const searchPlaceholder = type === 'DEROGATION' ? u.intituleDerog
    : type === 'PLAN_ACTION' ? u.searchPlanAction
    : u.searchAcceptation
  const porteurLabel = type === 'PLAN_ACTION' ? u.porteur : u.responsable
  // Traitements existants du même type = candidats au rattachement/mise à jour.
  const sameType = useMemo(() => existing.filter(x => x.type === type), [existing, type])

  // Champ de recherche/intitulé : vide au départ → focus = tous les existants,
  // saisie = filtre. En création sans saisie, on retombe sur un libellé par défaut.
  const [intitule, setIntitule] = useState('')
  const [responsable, setResponsable] = useState('')
  const [echeance, setEcheance] = useState('')
  const [description, setDescription] = useState('')
  const [maintien, setMaintien] = useState(false)
  const [niveau, setNiveau] = useState('')
  // Plan d'action : priorité propre (le plan d'action a un porteur + une priorité).
  const [priorite, setPriorite] = useState('MAJEUR')
  // Dérogation FORMELLE (workflow RSSI) : motif + mesures compensatoires requis,
  // + durée (jours) propre à la dérogation (date butoir ; défaut org si vide).
  const [motif, setMotif] = useState('')
  const [mesures, setMesures] = useState('')
  const [duree, setDuree] = useState('')
  // id du traitement existant sélectionné (null = création d'un nouveau).
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // id de l'ACTION réelle (PlanAction) sélectionnée à rattacher (null = aucune).
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null)
  const [actions, setActions] = useState<PlanActionLite[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const base = `/api/organizations/${orgId}/conformite/traitements`
  const plansBase = `/api/organizations/${orgId}/plans-actions`
  const isDerog = type === 'DEROGATION' // dérogation = workflow FORMEL (avis RSSI)
  const isUpdate = selectedId != null
  const isLinkAction = selectedActionId != null
  const locked = isUpdate || isLinkAction // libellé verrouillé (existant sélectionné)

  // Charge les actions réelles (plan d'action unifié) pour le rattachement — seulement
  // pour un traitement de type PLAN_ACTION (une dérogation/acceptation n'est pas une action).
  useEffect(() => {
    if (type !== 'PLAN_ACTION') return
    let alive = true
    fetch(plansBase).then(r => r.ok ? r.json() : { plans: [] }).then(d => {
      if (alive) setActions(Array.isArray(d.plans) ? d.plans : [])
    }).catch(() => {})
    return () => { alive = false }
  }, [type, plansBase])

  // Une action déjà rattachée à CE contrôle (lien CONFORMITE ref=controlRef) est exclue.
  const dejaLie = (a: PlanActionLite) =>
    (a.liens ?? []).some(l => l.type === 'CONFORMITE' && l.targetId === referentiel && l.ref === controlRef)

  // Suggestions : traitements de conformité existants (même type) + actions réelles
  // (pour PLAN_ACTION), filtrées par le texte saisi.
  const suggestions = useMemo(() => {
    if (isUpdate || isLinkAction || isDerog) return { traitements: [] as ExistingTraitement[], actions: [] as PlanActionLite[] }
    const q = intitule.trim().toLowerCase()
    // Plan d'action : on ne suggère QUE des actions réelles (les nouveaux plans sont
    // des PlanAction, plus des ConformiteTraitement). Acceptation : ses traitements.
    const tr = type === 'ACCEPTATION_RISQUE' ? sameType.filter(x => !q || x.intitule.toLowerCase().includes(q)).slice(0, 6) : []
    const ac = type !== 'PLAN_ACTION' ? [] :
      actions.filter(a => !dejaLie(a) && (!q || a.titre.toLowerCase().includes(q))).slice(0, 20)
    return { traitements: tr, actions: ac }
  }, [sameType, actions, intitule, isUpdate, isLinkAction, type]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasSuggestions = suggestions.traitements.length + suggestions.actions.length > 0

  function selectExisting(x: ExistingTraitement) {
    setSelectedId(x.id); setSelectedActionId(null)
    setIntitule(x.intitule)
    setResponsable(x.responsable ?? '')
    setEcheance(x.echeance ? x.echeance.slice(0, 10) : '')
    setDescription(x.description ?? '')
    setMaintien(Boolean(x.niveauRisqueMaintenu))
    setNiveau(x.niveauRisque ?? '')
    setOpen(false)
    setError(null)
  }

  // Sélection d'une action réelle : on la RATTACHE (lien CONFORMITE) sans modifier
  // son libellé ; les champs ne sont qu'informatifs.
  function selectAction(a: PlanActionLite) {
    setSelectedActionId(a.id); setSelectedId(null)
    setIntitule(a.titre)
    setResponsable(a.porteur ?? '')
    setEcheance(a.echeance ? a.echeance.slice(0, 10) : '')
    setDescription('')
    setOpen(false)
    setError(null)
  }

  // Repasse en création d'un nouveau traitement (réinitialise les champs).
  function resetToNew() {
    setSelectedId(null); setSelectedActionId(null)
    setIntitule('')
    setResponsable(''); setEcheance(''); setDescription(''); setMaintien(false); setNiveau('')
    setError(null)
  }

  async function submit() {
    if (isLinkAction) {
      // Rattache une action réelle au contrôle : ajoute un lien CONFORMITE (pas de
      // modification du libellé de l'action).
      setBusy(true); setError(null)
      const res = await fetch(`${plansBase}/${selectedActionId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addLien: { type: 'CONFORMITE', targetId: referentiel, ref: controlRef, label: controlNom } }),
      })
      setBusy(false)
      if (!res.ok) { setError(u.error); return }
      onApplied(entryTagForType(type))
      return
    }
    if (isDerog) {
      // Dérogation FORMELLE : crée une Derogation (portée CONTROLE) qui suivra le
      // workflow d'avis RSSI dans le registre /derogations.
      if (!motif.trim() || !mesures.trim()) { setError(u.derogChampsRequis); return }
      setBusy(true); setError(null)
      const res = await fetch('/api/derogations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portee: 'CONTROLE', referentiel, ref: controlRef,
          intitule: intitule.trim() || defaultTitle, motif: motif.trim(), mesuresCompensatoires: mesures.trim(),
          ...(Number(duree) > 0 ? { dureeJours: Number(duree) } : {}),
        }),
      })
      setBusy(false)
      if (!res.ok) { setError(u.error); return }
      onApplied(entryTagForType(type))
      return
    }
    if (type === 'PLAN_ACTION') {
      // Nouveau plan d'action = un VRAI PlanAction (porteur + priorité) porteur d'un
      // lien CONFORMITE vers ce contrôle.
      setBusy(true); setError(null)
      const res = await fetch(plansBase, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre: intitule.trim() || defaultTitle, description, porteur: responsable, echeance, priorite,
          liens: [{ type: 'CONFORMITE', targetId: referentiel, ref: controlRef, label: controlNom }],
        }),
      })
      setBusy(false)
      if (!res.ok) { setError(u.error); return }
      onApplied(entryTagForType(type))
      return
    }
    if (isUpdate) {
      // Mise à jour : on ne touche PAS au libellé ; on rattache aussi cette exigence.
      setBusy(true); setError(null)
      const res = await fetch(`${base}/${selectedId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description, responsable, echeance, addRef: controlRef,
          ...(type === 'ACCEPTATION_RISQUE' ? { niveauRisqueMaintenu: maintien, niveauRisque: niveau } : {}),
        }),
      })
      setBusy(false)
      if (!res.ok) { setError(u.error); return }
      onApplied(entryTagForType(type))
      return
    }
    setBusy(true); setError(null)
    const res = await fetch(base, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referentiel, entite, type, intitule: intitule.trim() || defaultTitle, description, responsable, echeance,
        refs: [controlRef],
        ...(type === 'ACCEPTATION_RISQUE' ? { niveauRisqueMaintenu: maintien, niveauRisque: niveau } : {}),
      }),
    })
    setBusy(false)
    if (!res.ok) { setError(u.error); return }
    onApplied(entryTagForType(type))
  }

  const inputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100'

  return (
    <div className="mt-2 p-3 rounded-lg border border-ebios-200 bg-ebios-50/60 dark:border-ebios-500/30 dark:bg-ebios-500/10 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ebios-800 dark:text-ebios-200">{typeLabel} · {controlRef}</span>
        <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
      </div>

      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}

      <div className="space-y-1.5">
        {/* Recherche/intitulé : en création, tape le libellé OU choisis un existant ;
            en mise à jour, le libellé est verrouillé (non modifiable ici). */}
        <div className="relative">
          <input
            value={intitule}
            onChange={e => { if (!locked) { setIntitule(e.target.value); setOpen(true) } }}
            onFocus={() => { if (!locked) setOpen(true) }}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            readOnly={locked}
            placeholder={searchPlaceholder}
            aria-label={u.intitule}
            className={`${inputCls} ${locked ? 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed' : ''}`}
          />
          {open && hasSuggestions && (
            <ul className="absolute z-10 left-0 right-0 mt-0.5 max-h-52 overflow-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg text-xs">
              {suggestions.actions.map(a => (
                <li key={`a-${a.id}`}>
                  <button type="button" onMouseDown={e => { e.preventDefault(); selectAction(a) }}
                    className="w-full text-left px-2 py-1.5 hover:bg-ebios-50 dark:hover:bg-ebios-500/10 flex items-center justify-between gap-2">
                    <span className="truncate text-gray-800 dark:text-gray-100">{a.titre}</span>
                    <span className="shrink-0 text-[9px] px-1 py-px rounded bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 font-medium">{u.actionTag}</span>
                  </button>
                </li>
              ))}
              {suggestions.traitements.map(x => (
                <li key={`t-${x.id}`}>
                  <button type="button" onMouseDown={e => { e.preventDefault(); selectExisting(x) }}
                    className="w-full text-left px-2 py-1.5 hover:bg-ebios-50 dark:hover:bg-ebios-500/10 flex items-center justify-between gap-2">
                    <span className="truncate text-gray-800 dark:text-gray-100">{x.intitule}</span>
                    <span className="shrink-0 text-[10px] text-gray-400">{u.covers.replace('{n}', String(x.refs.length))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {locked && (
          <div className="flex items-center justify-between text-[11px] text-ebios-700 dark:text-ebios-300">
            <span className="truncate">{isLinkAction ? u.linkActionHint : u.lockedHint}</span>
            <button type="button" onClick={resetToNew} className="shrink-0 text-gray-500 hover:text-gray-700 underline">{u.newInstead}</button>
          </div>
        )}

        {isDerog && (
          <p className="text-[11px] text-cyan-700 dark:text-cyan-300">{u.derogWorkflowHint}</p>
        )}
        {!isDerog && (
          <div className="flex gap-1.5">
            <input value={responsable} onChange={e => setResponsable(e.target.value)} readOnly={isLinkAction} placeholder={porteurLabel} className={`${inputCls} ${isLinkAction ? 'bg-gray-100 dark:bg-gray-900' : ''}`} />
            <input type="date" value={echeance} onChange={e => setEcheance(e.target.value)} readOnly={isLinkAction} title={u.echeance} className={`${inputCls} ${isLinkAction ? 'bg-gray-100 dark:bg-gray-900' : ''}`} />
            {type === 'PLAN_ACTION' && !isLinkAction && (
              <select value={priorite} onChange={e => setPriorite(e.target.value)} title={t.riskActions.priorite} className={inputCls}>
                {ACTION_PRIORITES.map(p => <option key={p} value={p}>{(t.riskActions.priorites as Record<string, string>)[p] ?? p}</option>)}
              </select>
            )}
          </div>
        )}
        {isDerog && (
          <>
            <textarea value={motif} onChange={e => setMotif(e.target.value)} placeholder={u.motifPh} rows={2} className={inputCls} />
            <textarea value={mesures} onChange={e => setMesures(e.target.value)} placeholder={u.mesuresPh} rows={2} className={inputCls} />
            <input type="number" min={1} value={duree} onChange={e => setDuree(e.target.value)} placeholder={u.dureeJoursPh} title={u.dureeJours} className={inputCls} />
          </>
        )}
        {!isLinkAction && !isDerog && (
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={u.descriptionLabel} rows={2} className={inputCls} />
        )}
        {type === 'ACCEPTATION_RISQUE' && !isLinkAction && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={maintien} onChange={e => setMaintien(e.target.checked)} /> {u.niveauRisqueMaintenu}
            </label>
            <input value={niveau} onChange={e => setNiveau(e.target.value)} placeholder={u.niveauRisquePh} className={`${inputCls} flex-1 min-w-[8rem]`} />
          </div>
        )}
        <div className="flex gap-2 pt-0.5">
          <button type="button" disabled={busy} onClick={submit}
            className="text-xs px-3 py-1 rounded bg-ebios-600 text-white font-medium disabled:opacity-50">
            {busy ? u.creating : isLinkAction ? u.attachBtn : isUpdate ? u.update : u.create}
          </button>
          <button type="button" onClick={onClose} className="text-xs px-2.5 py-1 rounded text-gray-500 hover:text-gray-700">{u.cancel}</button>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 truncate">{controlNom}</p>
    </div>
  )
}
