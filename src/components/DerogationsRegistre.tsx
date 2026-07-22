'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'
import { formatDate } from '@/lib/format'
import { etatDerogation, joursAvantExpiration, type DerogationEtat, type DerogationStatut } from '@/lib/derogation'

export interface RegistreRow {
  id: string
  analyseId: string
  analyseNom: string
  portee: string
  referentiel: string | null
  ref: string | null
  intitule: string
  statut: string
  dateFin: string | null
}

const BADGE: Record<DerogationEtat, string> = {
  DEMANDEE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  DOUBLE_REGARD: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  VALIDATION_METIER: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  EXPIRE_BIENTOT: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  EXPIREE: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  REJETEE: 'bg-gray-200 text-gray-700 dark:bg-gray-600/40 dark:text-gray-300',
  CLOTUREE: 'bg-slate-200 text-slate-700 dark:bg-slate-600/40 dark:text-slate-200',
  REVOQUEE: 'bg-gray-200 text-gray-700 dark:bg-gray-600/40 dark:text-gray-300',
}

// Fenêtre d'alerte par défaut pour l'affichage du registre (le seuil précis par
// organisation pilote les e-mails, pas cet aperçu).
const ALERTE_DEFAUT = 30

type Filtre = 'TOUS' | 'EN_REVUE' | 'ACTIVES' | 'A_ECHEANCE' | 'TERMINEES'

export default function DerogationsRegistre({ rows, locale }: { rows: RegistreRow[]; locale: string }) {
  const { t } = useTranslation()
  const d = t.derogations
  const [filtre, setFiltre] = useState<Filtre>('TOUS')

  const enriched = useMemo(() => rows.map(r => ({
    ...r,
    etat: etatDerogation({ statut: r.statut as DerogationStatut, dateFin: r.dateFin }, ALERTE_DEFAUT),
    jours: joursAvantExpiration(r.dateFin),
  })), [rows])

  const filtered = useMemo(() => enriched.filter(r => {
    switch (filtre) {
      case 'EN_REVUE': return ['DEMANDEE', 'DOUBLE_REGARD', 'VALIDATION_METIER'].includes(r.statut)
      case 'ACTIVES': return r.etat === 'ACTIVE'
      case 'A_ECHEANCE': return r.etat === 'EXPIRE_BIENTOT' || r.etat === 'EXPIREE'
      case 'TERMINEES': return ['REJETEE', 'CLOTUREE', 'REVOQUEE'].includes(r.statut)
      default: return true
    }
  }), [enriched, filtre])

  const count = (f: Filtre) => enriched.filter(r => {
    if (f === 'ACTIVES') return r.etat === 'ACTIVE'
    if (f === 'A_ECHEANCE') return r.etat === 'EXPIRE_BIENTOT' || r.etat === 'EXPIREE'
    if (f === 'EN_REVUE') return ['DEMANDEE', 'DOUBLE_REGARD', 'VALIDATION_METIER'].includes(r.statut)
    if (f === 'TERMINEES') return ['REJETEE', 'CLOTUREE', 'REVOQUEE'].includes(r.statut)
    return true
  }).length

  const filtres: { key: Filtre; label: string }[] = [
    { key: 'TOUS', label: `${d.filterAll} (${count('TOUS')})` },
    { key: 'EN_REVUE', label: `${d.filterReview} (${count('EN_REVUE')})` },
    { key: 'ACTIVES', label: `${d.statuts.ACTIVE} (${count('ACTIVES')})` },
    { key: 'A_ECHEANCE', label: `${d.filterDue} (${count('A_ECHEANCE')})` },
    { key: 'TERMINEES', label: `${d.filterDone} (${count('TERMINEES')})` },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">🪪 {d.title}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{d.subtitle}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {filtres.map(f => (
          <button key={f.key} onClick={() => setFiltre(f.key)}
            className={`text-sm px-3 py-1 rounded-full font-medium transition-colors ${filtre === f.key ? 'bg-ebios-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3">{d.intitule}</th>
              <th className="px-4 py-3">{d.colAnalyse}</th>
              <th className="px-4 py-3">{d.portee}</th>
              <th className="px-4 py-3">{d.colEtat}</th>
              <th className="px-4 py-3">{d.colEcheance}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 italic">{d.empty}</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{r.intitule}</td>
                <td className="px-4 py-3">
                  <Link href={`/analyses/${r.analyseId}`} className="text-ebios-600 dark:text-ebios-300 hover:underline">{r.analyseNom}</Link>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {(d.portees as Record<string, string>)[r.portee] ?? r.portee}
                  {r.referentiel && <span className="block text-xs">{r.referentiel}{r.ref && ` · ${r.ref}`}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${BADGE[r.etat]}`}>
                    {(d.statuts as Record<string, string>)[r.etat] ?? r.etat}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {r.dateFin ? (
                    <>
                      {formatDate(r.dateFin, locale)}
                      {r.etat === 'EXPIRE_BIENTOT' && <span className="block text-[11px] text-amber-600">{d.expiresIn.replace('{n}', String(r.jours))}</span>}
                      {r.etat === 'EXPIREE' && <span className="block text-[11px] text-red-600">{d.expiredSince.replace('{n}', String(-r.jours))}</span>}
                    </>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
