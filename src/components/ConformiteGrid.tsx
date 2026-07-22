'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import type { FrameworkControl } from '@/lib/frameworks-data'
import {
  CONFORMITE_STATUTS,
  conformiteStats,
  deriveNonConformites,
  type ConformiteEntry,
  type ConformiteStatut,
} from '@/lib/conformite'
import { etatDerogation, type DerogationStatut } from '@/lib/derogation'

interface Props {
  controles: FrameworkControl[]
  entries: ConformiteEntry[]
  onChange: (entries: ConformiteEntry[]) => void
  readOnly?: boolean
  /** Contexte dérogations : permet de déroger un contrôle non-conforme depuis la
   *  grille (bouton « Déroger » + badges). La grille vérifie elle-même que la
   *  fonctionnalité est active pour l'organisation (via l'API). */
  derogationCtx?: { analyseId: string; referentiel: string }
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
export default function ConformiteGrid({ controles, entries, onChange, readOnly = false, derogationCtx }: Props) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const sLabels = t.conformite.statuts as Record<string, string>
  const d = t.derogations

  // ── Dérogations : état par contrôle + création rapide depuis la grille ──
  const [derogActive, setDerogActive] = useState(false) // feature active pour l'org ?
  const [derogByRef, setDerogByRef] = useState<Map<string, DerogEtat>>(new Map())
  const [derogFormRef, setDerogFormRef] = useState<string | null>(null) // formulaire ouvert sur ce contrôle
  const [derogMotif, setDerogMotif] = useState('')
  const [derogMesures, setDerogMesures] = useState('')
  const [derogBusy, setDerogBusy] = useState(false)
  const [derogError, setDerogError] = useState<string | null>(null)

  async function reloadDerogations() {
    if (!derogationCtx) return
    const res = await fetch(`/api/analyses/${derogationCtx.analyseId}/derogations`)
    if (!res.ok) return
    const data = await res.json()
    setDerogActive(Boolean(data.config?.active))
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
      }),
    })
    const data = await res.json().catch(() => ({}))
    setDerogBusy(false)
    if (!res.ok) { setDerogError((d.errors as Record<string, string>)[data.error] ?? data.error ?? 'Erreur'); return }
    setDerogFormRef(null); setDerogMotif(''); setDerogMesures('')
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
    next.push({ ref, statut, ...(prev?.commentaire ? { commentaire: prev.commentaire } : {}) })
    onChange(next)
  }

  function setComment(ref: string, commentaire: string) {
    if (readOnly) return
    const prev = byRef.get(ref)
    const statut = prev?.statut ?? 'non_conforme'
    const next = entries.filter(e => e.ref !== ref)
    next.push({ ref, statut, ...(commentaire.trim() ? { commentaire } : {}) })
    onChange(next)
  }

  return (
    <div>
      <h3 className="font-semibold text-gray-800 mb-1">{t.conformite.gridTitle}</h3>
      <p className="text-xs text-gray-500 mb-3">{t.conformite.gridIntro}</p>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <div className="text-2xl font-bold text-ebios-700">{stats.tauxConformite}%</div>
          <div className="text-xs text-gray-500">{t.conformite.statTaux}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <div className="text-2xl font-bold text-gray-800">{stats.evalues}/{stats.total}</div>
          <div className="text-xs text-gray-500">{t.conformite.statEvalues}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{nonConformites.length}</div>
          <div className="text-xs text-gray-500">{t.conformite.statNonConf}</div>
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
              {/* Dérogation : badge d'état, ou demande rapide sur une non-conformité */}
              {derogationCtx && derogActive && showComment && (() => {
                const etat = derogByRef.get(c.ref) ?? null
                if (etat === 'ACTIVE') return (
                  <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300">
                    🪪 {sLabels.deroge ?? 'Dérogé'}
                  </span>
                )
                if (etat === 'EN_REVUE') return (
                  <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                    🪪 {d.filterReview}
                  </span>
                )
                if (readOnly) return null
                if (derogFormRef !== c.ref) return (
                  <button type="button" onClick={() => { setDerogFormRef(c.ref); setDerogError(null) }}
                    className="mt-2 text-xs text-cyan-700 dark:text-cyan-300 hover:underline font-medium">
                    🪪 {d.derogerBtn}
                  </button>
                )
                return (
                  <div className="mt-2 space-y-1.5 p-2.5 rounded-lg bg-cyan-50/60 border border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-500/40">
                    {derogError && <p className="text-xs text-red-600">{derogError}</p>}
                    <textarea value={derogMotif} onChange={e => setDerogMotif(e.target.value)}
                      placeholder={d.motifPlaceholder} rows={2} className="input w-full text-xs" />
                    <textarea value={derogMesures} onChange={e => setDerogMesures(e.target.value)}
                      placeholder={d.mesuresPlaceholder} rows={2} className="input w-full text-xs" />
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

      {/* Catalogue de vulnérabilités (non-conformités) */}
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
    </div>
  )
}
