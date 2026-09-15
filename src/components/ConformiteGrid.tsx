'use client'

import { IdCard } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import type { FrameworkControl } from '@/lib/frameworks-data'
import {
  CONFORMITE_STATUTS,
  CONFORMITE_TRAITEMENTS,
  conformiteStats,
  deriveNonConformites,
  type ConformiteEntry,
  type ConformiteStatut,
  type ConformiteTraitement,
} from '@/lib/conformite'
import { etatDerogation, type DerogationStatut } from '@/lib/derogation'
import { typeForEntryTag } from '@/lib/conformite-traitement'
import TraitementPopover, { type ExistingTraitement } from '@/components/TraitementPopover'

interface Props {
  controles: FrameworkControl[]
  entries: ConformiteEntry[]
  onChange: (entries: ConformiteEntry[]) => void
  readOnly?: boolean
  /** Contexte dérogations : permet de déroger un contrôle non-conforme depuis la
   *  grille (bouton « Déroger » + badges). La grille vérifie elle-même que la
   *  fonctionnalité est active pour l'organisation (via l'API). */
  derogationCtx?: { analyseId: string; referentiel: string }
  /** Contexte traitements réels (socle org) : choisir « plan/dérogation/acceptation »
   *  crée/rattache un vrai ConformiteTraitement (multi-exigences). */
  traitementCtx?: { orgId: string; referentiel: string; entite: string }
  /** Notifie le parent (registre) après création/rattachement d'un traitement. */
  onTraitementsChanged?: () => void
  /** Affiche le catalogue de vulnérabilités (écarts) — pertinent en analyse, pas en socle pur. */
  showVulnCatalog?: boolean
}

/** État dérogation d'un contrôle, dérivé de la liste des dérogations de l'analyse. */
type DerogEtat = 'ACTIVE' | 'EN_REVUE' | null

const STATUT_STYLE: Record<ConformiteStatut, { on: string; dot: string }> = {
  conforme:     { on: 'bg-green-600 text-white border-green-600',   dot: 'bg-green-500' },
  partiel:      { on: 'bg-amber-500 text-white border-amber-500',   dot: 'bg-amber-500' },
  non_conforme: { on: 'bg-red-600 text-white border-red-600',       dot: 'bg-red-500' },
  na:           { on: 'bg-gray-400 text-white border-gray-400',     dot: 'bg-gray-300' },
}

/**
 * Grille de conformité au référentiel (atelier 1). Affichée si la fonctionnalité
 * est activée (OrganizationConfig.conformiteActive). Les non-conformités dérivées
 * forment le catalogue de vulnérabilités (cf. lib/conformite.ts).
 */
export default function ConformiteGrid({ controles, entries, onChange, readOnly = false, derogationCtx, traitementCtx, onTraitementsChanged, showVulnCatalog = true }: Props) {
  const { t, locale } = useTranslation()
  const [search, setSearch] = useState('')

  // Traitements réels (socle org) : liste chargée + popover création/rattachement.
  const [traitements, setTraitements] = useState<ExistingTraitement[]>([])
  const [popover, setPopover] = useState<{ ref: string; type: import('@/lib/conformite-traitement').TraitementType } | null>(null)
  async function reloadTraitements() {
    if (!traitementCtx) return
    const qs = `referentiel=${encodeURIComponent(traitementCtx.referentiel)}&entite=${encodeURIComponent(traitementCtx.entite)}`
    const res = await fetch(`/api/organizations/${traitementCtx.orgId}/conformite/traitements?${qs}`).then(r => r.ok ? r.json() : null).catch(() => null)
    const rows = Array.isArray(res?.traitements) ? res.traitements : []
    setTraitements(rows.map((x: { id: string; type: string; intitule: string; refs: unknown; description?: string | null; responsable?: string | null; echeance?: string | null; statut?: string; niveauRisqueMaintenu?: boolean; niveauRisque?: string | null }) => ({
      id: x.id, type: x.type, intitule: x.intitule, refs: Array.isArray(x.refs) ? x.refs as string[] : [],
      description: x.description ?? null, responsable: x.responsable ?? null,
      echeance: x.echeance ?? null, statut: x.statut, niveauRisqueMaintenu: x.niveauRisqueMaintenu, niveauRisque: x.niveauRisque ?? null,
    })))
  }
  useEffect(() => { reloadTraitements() }, [traitementCtx?.orgId, traitementCtx?.referentiel, traitementCtx?.entite]) // eslint-disable-line react-hooks/exhaustive-deps
  const sLabels = t.conformite.statuts as Record<string, string>
  const d = t.derogations

  // ── Dérogations : état par contrôle + création rapide depuis la grille ──
  const [derogActive, setDerogActive] = useState(false) // feature active pour l'org ?
  const [derogByRef, setDerogByRef] = useState<Map<string, DerogEtat>>(new Map())
  const [derogFormRef, setDerogFormRef] = useState<string | null>(null) // formulaire ouvert sur ce contrôle
  const [derogMotif, setDerogMotif] = useState('')
  const [derogMesures, setDerogMesures] = useState('')
  const [derogDuree, setDerogDuree] = useState('')
  const [dureeDefaut, setDureeDefaut] = useState(180)
  const [dureeMax, setDureeMax] = useState(365)
  const [derogBusy, setDerogBusy] = useState(false)
  const [derogError, setDerogError] = useState<string | null>(null)

  async function reloadDerogations() {
    if (!derogationCtx) return
    const res = await fetch(`/api/analyses/${derogationCtx.analyseId}/derogations`)
    if (!res.ok) return
    const data = await res.json()
    setDerogActive(Boolean(data.config?.active))
    if (typeof data.config?.dureeDefautJours === 'number') setDureeDefaut(data.config.dureeDefautJours)
    if (typeof data.config?.dureeMaxJours === 'number') setDureeMax(data.config.dureeMaxJours)
    const alerte = typeof data.config?.alerteJours === 'number' ? data.config.alerteJours : 30
    const m = new Map<string, DerogEtat>()
    for (const x of (data.derogations ?? []) as { portee: string; referentiel: string | null; ref: string | null; statut: DerogationStatut; dateFin: string | null }[]) {
      if (x.portee !== 'CONTROLE' || x.referentiel !== derogationCtx.referentiel || !x.ref) continue
      const etat = etatDerogation({ statut: x.statut, dateFin: x.dateFin }, alerte)
      if (etat === 'ACTIVE' || etat === 'EXPIRE_BIENTOT') { m.set(x.ref, 'ACTIVE'); continue }
      if ((x.statut === 'DEMANDEE' || x.statut === 'DOUBLE_REGARD' || x.statut === 'VALIDATION_METIER') && m.get(x.ref) !== 'ACTIVE') m.set(x.ref, 'EN_REVUE')
    }
    setDerogByRef(m)
  }
  useEffect(() => { reloadDerogations() }, [derogationCtx?.analyseId, derogationCtx?.referentiel]) // eslint-disable-line react-hooks/exhaustive-deps

  // Demande minimale : intitulé auto-généré, seuls motif + mesures compensatoires à saisir.
  async function submitDerogation(c: FrameworkControl) {
    if (!derogationCtx) return
    setDerogBusy(true); setDerogError(null)
    const res = await fetch(`/api/analyses/${derogationCtx.analyseId}/derogations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portee: 'CONTROLE',
        referentiel: derogationCtx.referentiel,
        ref: c.ref,
        intitule: `${d.autoTitle} — ${c.ref} · ${c.nom}`.slice(0, 255),
        motif: derogMotif,
        mesuresCompensatoires: derogMesures,
        dureeJours: derogDuree ? Number(derogDuree) : undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setDerogBusy(false)
    if (!res.ok) { setDerogError((d.errors as Record<string, string>)[data.error] ?? data.error ?? 'Erreur'); return }
    setDerogFormRef(null); setDerogMotif(''); setDerogMesures(''); setDerogDuree('')
    reloadDerogations()
  }

  const byRef = useMemo(() => {
    const m = new Map<string, ConformiteEntry>()
    for (const e of entries) m.set(e.ref, e)
    return m
  }, [entries])

  const stats = useMemo(() => conformiteStats(entries, controles.length), [entries, controles.length])
  const nonConformites = useMemo(() => deriveNonConformites(entries), [entries])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return controles
    return controles.filter(c =>
      c.ref.toLowerCase().includes(q) || c.nom.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    )
  }, [controles, search])

  function setStatut(ref: string, statut: ConformiteStatut) {
    if (readOnly) return
    const next = entries.filter(e => e.ref !== ref)
    const prev = byRef.get(ref)
    const ecart = statut === 'partiel' || statut === 'non_conforme'
    next.push({
      ref, statut,
      ...(prev?.commentaire ? { commentaire: prev.commentaire } : {}),
      ...(ecart && prev?.traitement ? { traitement: prev.traitement } : {}),
    })
    onChange(next)
  }

  function setComment(ref: string, commentaire: string) {
    if (readOnly) return
    const prev = byRef.get(ref)
    const statut = prev?.statut ?? 'non_conforme'
    const ecart = statut === 'partiel' || statut === 'non_conforme'
    const next = entries.filter(e => e.ref !== ref)
    next.push({
      ref, statut,
      ...(commentaire.trim() ? { commentaire } : {}),
      ...(ecart && prev?.traitement ? { traitement: prev.traitement } : {}),
    })
    onChange(next)
  }

  // Traitement de l'écart (partiel/non conforme) : clic = sélection, re-clic = retrait.
  function setTraitement(ref: string, traitement: ConformiteTraitement) {
    if (readOnly) return
    const prev = byRef.get(ref)
    if (!prev || (prev.statut !== 'partiel' && prev.statut !== 'non_conforme')) return
    const next = entries.filter(e => e.ref !== ref)
    const nextTr = prev.traitement === traitement ? undefined : traitement
    next.push({ ...prev, ...(nextTr ? { traitement: nextTr } : {}), ...(nextTr ? {} : {}) })
    if (!nextTr) delete (next[next.length - 1] as { traitement?: unknown }).traitement
    onChange(next)
  }

  // Applique une étiquette de traitement sans bascule (après création/rattachement réel).
  function forceTraitement(ref: string, traitement: ConformiteTraitement) {
    const prev = byRef.get(ref)
    if (!prev || (prev.statut !== 'partiel' && prev.statut !== 'non_conforme')) return
    onChange([...entries.filter(e => e.ref !== ref), { ...prev, traitement }])
  }

  return (
    <div>
      <h3 className="font-semibold text-gray-800 mb-1">{t.conformite.gridTitle}</h3>
      <p className="text-xs text-gray-500 mb-3">{t.conformite.gridIntro}</p>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:border-gray-700 dark:bg-gray-800">
          <div className="text-2xl font-bold text-ebios-700 dark:text-ebios-300">{stats.tauxConformite}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{t.conformite.statTaux}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:border-gray-700 dark:bg-gray-800">
          <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.evalues}/{stats.total}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{t.conformite.statEvalues}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center dark:border-gray-700 dark:bg-gray-800">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{nonConformites.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{t.conformite.statNonConf}</div>
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={t.conformite.searchPh}
        className="input w-full mb-3 text-sm"
      />

      {/* Grille */}
      <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
        {filtered.map(c => {
          const entry = byRef.get(c.ref)
          const showComment = entry && (entry.statut === 'partiel' || entry.statut === 'non_conforme')
          return (
            <div key={c.ref} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    <span className="text-gray-400 mr-1.5">{c.ref}</span>{c.nom}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.description}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                  {CONFORMITE_STATUTS.map(s => {
                    const active = entry?.statut === s
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={readOnly}
                        onClick={() => setStatut(c.ref, s)}
                        className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                          active ? STATUT_STYLE[s].on : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {sLabels[s] ?? s}
                      </button>
                    )
                  })}
                </div>
              </div>
              {showComment && (
                <input
                  type="text"
                  value={entry?.commentaire ?? ''}
                  onChange={e => setComment(c.ref, e.target.value)}
                  placeholder={t.conformite.commentPh}
                  disabled={readOnly}
                  className="input w-full mt-2 text-xs"
                />
              )}
              {/* Traitement de l'écart : plan d'action / dérogation / acceptation de risque */}
              {showComment && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 mr-0.5">{t.conformite.traitementLabel} :</span>
                  {CONFORMITE_TRAITEMENTS.map(tr => {
                    const active = entry?.traitement === tr
                    // En contexte socle (traitementCtx) : ouvrir le popover pour créer/rattacher un
                    // vrai traitement ; un re-clic sur l'actif retire l'étiquette. Sinon simple bascule.
                    const onClick = () => {
                      if (!traitementCtx) return setTraitement(c.ref, tr)
                      if (active) return setTraitement(c.ref, tr) // retire l'étiquette
                      setPopover({ ref: c.ref, type: typeForEntryTag(tr) })
                    }
                    return (
                      <button key={tr} type="button" disabled={readOnly} onClick={onClick}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                          active
                            ? 'bg-ebios-600 text-white border-ebios-600'
                            : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600'
                        }`}>
                        {(t.conformite.traitements as Record<string, string>)[tr] ?? tr}
                      </button>
                    )
                  })}
                  {/* Clore l'action : le contrôle passe conforme (l'écart est résolu). */}
                  {entry?.traitement === 'plan_action' && !readOnly && (
                    <button type="button" onClick={() => setStatut(c.ref, 'conforme')}
                      title={t.conformite.cloreActionHint}
                      className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-green-600 text-green-700 hover:bg-green-50 dark:text-green-300 dark:border-green-500/50 dark:hover:bg-green-500/10">
                      ✓ {t.conformite.cloreAction}
                    </button>
                  )}
                </div>
              )}
              {/* Popover de création / rattachement d'un traitement réel */}
              {traitementCtx && popover?.ref === c.ref && (
                <TraitementPopover
                  orgId={traitementCtx.orgId} referentiel={traitementCtx.referentiel} entite={traitementCtx.entite}
                  controlRef={c.ref} controlNom={c.nom} type={popover.type} existing={traitements}
                  onApplied={(tag) => { forceTraitement(c.ref, tag); setPopover(null); reloadTraitements(); onTraitementsChanged?.() }}
                  onClose={() => setPopover(null)}
                />
              )}
              {/* Dérogation : badge d'état, ou demande rapide sur une non-conformité */}
              {derogationCtx && derogActive && showComment && (() => {
                const etat = derogByRef.get(c.ref) ?? null
                if (etat === 'ACTIVE') return (
                  <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300">
                    <IdCard size={15} className="inline align-[-0.15em] mr-1.5" aria-hidden="true" /> {sLabels.deroge ?? 'Dérogé'}
                  </span>
                )
                if (etat === 'EN_REVUE') return (
                  <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                    <IdCard size={15} className="inline align-[-0.15em] mr-1.5" aria-hidden="true" /> {d.filterReview}
                  </span>
                )
                if (readOnly) return null
                if (derogFormRef !== c.ref) return (
                  <button type="button" onClick={() => { setDerogFormRef(c.ref); setDerogError(null) }}
                    className="mt-2 text-xs text-cyan-700 dark:text-cyan-300 hover:underline font-medium">
                    <IdCard size={15} className="inline align-[-0.15em] mr-1.5" aria-hidden="true" /> {d.derogerBtn}
                  </button>
                )
                return (
                  <div className="mt-2 space-y-1.5 p-2.5 rounded-lg bg-cyan-50/60 border border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-500/40">
                    {derogError && <p className="text-xs text-red-600">{derogError}</p>}
                    <label className="block text-xs text-gray-600 dark:text-gray-300">
                      <span className="block mb-1 font-medium">{d.motif}</span>
                      <textarea value={derogMotif} onChange={e => setDerogMotif(e.target.value)}
                        placeholder={d.motifPlaceholder} rows={2} className="input w-full text-xs" />
                    </label>
                    <label className="block text-xs text-gray-600 dark:text-gray-300">
                      <span className="block mb-1 font-medium">{d.mesuresCompensatoires}</span>
                      <textarea value={derogMesures} onChange={e => setDerogMesures(e.target.value)}
                        placeholder={d.mesuresPlaceholder} rows={2} className="input w-full text-xs" />
                    </label>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-gray-600 dark:text-gray-300">
                      <span className="font-medium">{d.dureeLabel}</span>
                      <input type="number" min={1} max={dureeMax} value={derogDuree}
                        onChange={e => setDerogDuree(e.target.value)}
                        placeholder={String(dureeDefaut)} className="input w-24 text-xs" />
                      <span className="text-gray-400">{d.dureeMaxHint?.replace('{max}', String(dureeMax))}</span>
                      {(() => { const j = Number(derogDuree || dureeDefaut); return j > 0 ? <span className="ml-1">→ {d.dateFinLabel} : <strong className="text-gray-800 dark:text-gray-100">{formatDate(new Date(Date.now() + j * 86400000).toISOString(), locale)}</strong></span> : null })()}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" disabled={derogBusy} onClick={() => submitDerogation(c)}
                        className="text-xs px-2.5 py-1 rounded bg-cyan-600 text-white font-medium disabled:opacity-50">
                        {d.submit}
                      </button>
                      <button type="button" onClick={() => setDerogFormRef(null)}
                        className="text-xs px-2.5 py-1 rounded text-gray-500 hover:text-gray-700">
                        {d.cancel}
                      </button>
                    </div>
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>

      {/* Catalogue de vulnérabilités (non-conformités) — masqué hors contexte d'analyse
          (ex. éditeur de socle org : conformité pure, sans lien ateliers 3/4). */}
      {showVulnCatalog && (
      <div className="mt-5 p-4 rounded-lg bg-red-50 border border-red-100">
        <p className="text-sm font-semibold text-red-800 mb-1">{t.conformite.catalogueTitle}</p>
        <p className="text-xs text-gray-500 mb-2">{t.conformite.catalogueIntro}</p>
        {nonConformites.length === 0 ? (
          <p className="text-sm text-gray-500">{t.conformite.catalogueEmpty}</p>
        ) : (
          <ul className="space-y-1">
            {nonConformites.map(nc => {
              const ctl = controles.find(c => c.ref === nc.ref)
              return (
                <li key={nc.ref} className="text-sm text-gray-700 flex gap-2">
                  <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${STATUT_STYLE[nc.statut].dot}`} />
                  <span>
                    <span className="text-gray-400 mr-1">{nc.ref}</span>
                    {ctl?.nom ?? nc.ref}
                    {nc.commentaire && <span className="text-gray-500"> — {nc.commentaire}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      )}
    </div>
  )
}
