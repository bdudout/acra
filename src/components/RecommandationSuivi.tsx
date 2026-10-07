'use client'

// ─── Suivi d'une recommandation d'audit ──────────────────────────────────────
// L'audité (canFollow) déclare la réalisation et demande un report d'échéance ; l'audit
// (canAudit) vérifie — jamais la personne qui l'a déclarée réalisée —, rouvre avec un motif
// et décide des reports. Les règles sont appliquées par l'API (lib/audit-l4.appliquerSuivi).

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

export interface ConstatSuiviData {
  id: string; statut: string; echeance: string | null; echeanceInitiale: string | null; reports: unknown
  critere: string | null; cause: string | null; consequence: string | null
  realiseeLe?: string | null; verifieLe?: string | null; verificationCommentaire?: string | null
}
export type SuiviAction =
  | { action: 'DECLARER_REALISE' } | { action: 'VERIFIER'; commentaire?: string } | { action: 'REOUVRIR'; commentaire: string }
  | { action: 'DEMANDER_REPORT'; nouvelleEcheance: string; motif: string } | { action: 'DECIDER_REPORT'; index: number; decision: 'APPROUVE' | 'REFUSE' }
interface Report { nouvelle: string; motif: string; demandeLe: string; statut: string }
const inp = 'px-2 py-1 rounded-sm border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-xs'

export default function RecommandationSuivi({ constat, canAudit, canFollow, busy, onAction }: {
  constat: ConstatSuiviData; canAudit: boolean; canFollow: boolean; busy: boolean; onAction: (a: SuiviAction) => void
}) {
  const { t, locale } = useTranslation()
  const l = t.auditInterne.l4
  const [commentaire, setCommentaire] = useState('')
  const [motifReouverture, setMotifReouverture] = useState('')
  const [nouvelle, setNouvelle] = useState('')
  const [motif, setMotif] = useState('')
  const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(locale, { timeZone: 'UTC' }) : '—')
  const reports = (Array.isArray(constat.reports) ? constat.reports : []) as Report[]
  const ouvert = constat.statut === 'OUVERT' || constat.statut === 'EN_COURS'
  const rs = l.reportStatuts as Record<string, string>

  return (
    <div className="space-y-2 text-xs" aria-label={l.suiviTitle}>
      {(constat.critere || constat.cause || constat.consequence) && (
        <dl className="grid gap-1 sm:grid-cols-3">
          {([[l.critere, constat.critere], [l.cause, constat.cause], [l.consequence, constat.consequence]] as [string, string | null][]).filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><dt className="font-semibold text-gray-500">{k}</dt><dd className="text-gray-800 dark:text-gray-100">{v}</dd></div>
          ))}
        </dl>
      )}
      <p className="text-gray-500">
        {constat.echeanceInitiale && <span>{l.echeanceInitiale} : {day(constat.echeanceInitiale)} · </span>}
        {constat.realiseeLe && <span>{l.realiseePar} {day(constat.realiseeLe)} · </span>}
        {constat.verifieLe && <span>{l.verifieLe} {day(constat.verifieLe)}{constat.verificationCommentaire ? ` — ${constat.verificationCommentaire}` : ''}</span>}
      </p>

      {reports.length > 0 && (
        <div>
          <p className="font-semibold text-gray-600 dark:text-gray-300">{l.reports}</p>
          <ul className="space-y-1">
            {reports.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums">{day(r.nouvelle)}</span><span className="text-gray-600 dark:text-gray-300">{r.motif}</span>
                <span className="rounded-full bg-gray-100 px-1.5 py-px text-[10px] dark:bg-gray-700">{rs[r.statut] ?? r.statut}</span>
                {canAudit && r.statut === 'DEMANDE' && <>
                  <button type="button" disabled={busy} onClick={() => onAction({ action: 'DECIDER_REPORT', index: i, decision: 'APPROUVE' })} className="btn-secondary text-[11px] disabled:opacity-50">{l.approuver}</button>
                  <button type="button" disabled={busy} onClick={() => onAction({ action: 'DECIDER_REPORT', index: i, decision: 'REFUSE' })} className="text-[11px] text-red-600 hover:underline disabled:opacity-50">{l.refuser}</button>
                </>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {canFollow && ouvert && (
        <div className="flex flex-wrap items-end gap-2">
          <button type="button" disabled={busy} onClick={() => onAction({ action: 'DECLARER_REALISE' })} className="btn-secondary text-xs disabled:opacity-50">{l.declarerRealise}</button>
          <label className="text-gray-500">{l.nouvelleEcheance}<input type="date" aria-label={l.nouvelleEcheance} value={nouvelle} onChange={e => setNouvelle(e.target.value)} className={`${inp} block mt-1`} /></label>
          <label className="text-gray-500">{l.motif}<input aria-label={l.motif} value={motif} maxLength={2000} onChange={e => setMotif(e.target.value)} className={`${inp} block mt-1 w-56`} /></label>
          <button type="button" disabled={busy || !nouvelle || !motif.trim()} onClick={() => onAction({ action: 'DEMANDER_REPORT', nouvelleEcheance: nouvelle, motif: motif.trim() })} className="btn-secondary text-xs disabled:opacity-50">{l.envoyer}</button>
        </div>
      )}
      {canAudit && constat.statut === 'RESOLU' && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-gray-500">{l.verifierCommentaire}<input aria-label={l.verifierCommentaire} value={commentaire} onChange={e => setCommentaire(e.target.value)} className={`${inp} block mt-1 w-56`} /></label>
          <button type="button" disabled={busy} onClick={() => onAction({ action: 'VERIFIER', ...(commentaire.trim() ? { commentaire: commentaire.trim() } : {}) })} className="btn-primary text-xs disabled:opacity-50">{l.verifier}</button>
        </div>
      )}
      {canAudit && (constat.statut === 'RESOLU' || constat.statut === 'VERIFIE') && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-gray-500">{l.rouvrirMotif}<input aria-label={l.rouvrirMotif} value={motifReouverture} onChange={e => setMotifReouverture(e.target.value)} className={`${inp} block mt-1 w-56`} /></label>
          <button type="button" disabled={busy || !motifReouverture.trim()} onClick={() => onAction({ action: 'REOUVRIR', commentaire: motifReouverture.trim() })} className="text-xs text-red-600 hover:underline disabled:opacity-50">{l.rouvrir}</button>
        </div>
      )}
    </div>
  )
}
