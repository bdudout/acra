'use client'

// ─── Suivi de l'AIPD d'un traitement (RGPD art. 35-36) ────────────────────────
// Statut, analyse ACRA rattachée (analyses lisibles de l'organisation), date de réalisation, justification d'une AIPD
// non retenue, consultation préalable de l'autorité de contrôle. « Créer l'analyse » : rôles autorisés seulement.
// API : PATCH /api/ropa/[id]/aipd ; règles : lib/ropa-aipd.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'
import { STATUTS_AIPD } from '@/lib/ropa-aipd'

export interface TraitementAipd {
  id: string; nom: string; aipdStatut: string | null; aipdAnalyseId: string | null; aipdDate: string | null
  aipdJustification: string; aipdConsultationPrealable: boolean
}

export default function AipdSuiviPanel({ traitement, peutCreerAnalyse, onEnregistre, onAnnuler }: {
  traitement: TraitementAipd; peutCreerAnalyse: boolean; onEnregistre: () => void; onAnnuler: () => void
}) {
  const { t } = useTranslation()
  const a = t.ropa.aipd
  const [statut, setStatut] = useState(traitement.aipdStatut ?? '')
  const [analyseId, setAnalyseId] = useState(traitement.aipdAnalyseId ?? '')
  const [date, setDate] = useState(traitement.aipdDate?.slice(0, 10) ?? '')
  const [justification, setJustification] = useState(traitement.aipdJustification)
  const [consultation, setConsultation] = useState(traitement.aipdConsultationPrealable)
  const [analyses, setAnalyses] = useState<{ id: string; nom: string }[]>([])
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/analyses').then(x => (x.ok ? x.json() : null))
      .then((j: { analyses?: { id: string; nom: string }[] } | null) => setAnalyses((j?.analyses ?? []).map(x => ({ id: x.id, nom: x.nom })))).catch(() => setAnalyses([]))
  }, [])

  async function enregistrer() {
    setErreur(null)
    const res = await fetch(`/api/ropa/${traitement.id}/aipd`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      aipdStatut: statut || null, aipdAnalyseId: analyseId || null, aipdDate: date || null, aipdJustification: justification, aipdConsultationPrealable: consultation,
    }) }).catch(() => null)
    if (res?.ok) { onEnregistre(); return }
    const j = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {}
    setErreur((a.erreurs as Record<string, string>)[j.error ?? ''] ?? a.erreurs.defaut)
  }

  const champ = 'mt-1 block w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-900 dark:border-gray-600'
  const label = 'text-xs text-gray-500 dark:text-gray-400'
  return (
    <div className="rounded-sm border border-ebios-200 dark:border-ebios-700 bg-ebios-50/40 dark:bg-ebios-500/5 p-3 space-y-3" role="region" aria-label={a.titre.replace('{nom}', traitement.nom)}>
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{a.titre.replace('{nom}', traitement.nom)}</p>
      <div className="grid md:grid-cols-3 gap-3">
        <label className={label}>{a.statut}
          <select aria-label={a.statut} value={statut} onChange={e => setStatut(e.target.value)} className={champ}>
            <option value="">—</option>
            {STATUTS_AIPD.map(s => <option key={s} value={s}>{a.statuts[s]}</option>)}
          </select>
        </label>
        <label className={label}>{a.analyse}
          <select aria-label={a.analyse} value={analyseId} onChange={e => setAnalyseId(e.target.value)} className={champ}>
            <option value="">{a.aucuneAnalyse}</option>
            {analyses.map(x => <option key={x.id} value={x.id}>{x.nom}</option>)}
          </select>
        </label>
        <label className={label}>{a.date}<input aria-label={a.date} type="date" value={date} onChange={e => setDate(e.target.value)} className={champ} /></label>
      </div>
      {peutCreerAnalyse && <Link href="/analyses/new" className="text-xs text-ebios-700 dark:text-ebios-300 underline">{a.creerAnalyse}</Link>}
      {statut === 'NON_RETENUE' && (
        <label className={`${label} block`}>{a.justification}
          <textarea aria-label={a.justification} value={justification} onChange={e => setJustification(e.target.value)} rows={2} className={champ} />
        </label>
      )}
      {statut === 'REALISEE' && (
        <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200">
          <input type="checkbox" checked={consultation} onChange={e => setConsultation(e.target.checked)} />{a.consultation}
        </label>
      )}
      {erreur && <p role="alert" className="text-sm text-red-600">{erreur}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={enregistrer} className="btn-primary text-sm">{a.enregistrer}</button>
        <button type="button" onClick={onAnnuler} className="btn-secondary text-sm">{a.annuler}</button>
      </div>
    </div>
  )
}
