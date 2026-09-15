'use client'

// Registre des TRAITEMENTS réels des écarts de conformité (plan d'action /
// dérogation / acceptation de risque) d'un suivi org × référentiel × entité.
// Suivi des acceptations de risque (niveau maintenu) inclus. Réservé socle org.

import { useCallback, useEffect, useState } from 'react'
import { Trash2, ClipboardList, ShieldAlert, CalendarClock } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { formatDate } from '@/lib/format'
import { entryTagForType, type TraitementType } from '@/lib/conformite-traitement'

interface Row {
  id: string; type: TraitementType; intitule: string; refs: string[]; statut: string
  responsable: string | null; echeance: string | null
  niveauRisqueMaintenu: boolean; niveauRisque: string | null
}

const TYPE_STYLE: Record<string, string> = {
  PLAN_ACTION: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  DEROGATION: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  ACCEPTATION_RISQUE: 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
}

export default function TraitementsRegistre({ orgId, referentiel, entite, locale, canEdit }: {
  orgId: string; referentiel: string; entite: string; locale: string; canEdit: boolean
}) {
  const { t } = useTranslation()
  const c = t.conformite
  const u = c.traitementUI
  const [rows, setRows] = useState<Row[]>([])
  // Repliable : le registre peut être volumineux et limiter le défilement de la
  // grille du référentiel → on peut le replier (ouvert par défaut).
  const [open, setOpen] = useState(true)
  const base = `/api/organizations/${orgId}/conformite/traitements`

  const load = useCallback(async () => {
    const qs = `referentiel=${encodeURIComponent(referentiel)}&entite=${encodeURIComponent(entite)}`
    const res = await fetch(`${base}?${qs}`).then(r => r.ok ? r.json() : null).catch(() => null)
    const list = Array.isArray(res?.traitements) ? res.traitements : []
    setRows(list.map((x: Row & { refs: unknown }) => ({ ...x, refs: Array.isArray(x.refs) ? x.refs as string[] : [] })))
  }, [base, referentiel, entite])

  useEffect(() => { load() }, [load])

  async function supprimer(id: string) {
    if (!confirm(c.registreDelete)) return
    const res = await fetch(`${base}/${id}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  if (rows.length === 0) return null // rien à afficher tant qu'aucun traitement

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
        <span className="text-gray-400">{open ? '▾' : '▸'}</span>
        <ClipboardList size={15} aria-hidden="true" /> {c.registreTitre}
        <span className="ml-1 text-[11px] font-normal text-gray-400">({rows.length})</span>
      </button>
      {open && (
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {rows.map(r => (
          <li key={r.id} className="py-2 flex items-start gap-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${TYPE_STYLE[r.type] ?? ''}`}>
                  {(c.traitements as Record<string, string>)[entryTagForType(r.type)] ?? r.type}
                </span>
                <span className="font-medium text-gray-800 dark:text-gray-100 truncate">{r.intitule}</span>
                <span className="text-[11px] text-gray-400">{u.covers.replace('{n}', String(r.refs.length))}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                {r.responsable && <span>{u.responsable}: {r.responsable}</span>}
                {r.echeance && <span className="inline-flex items-center gap-1"><CalendarClock size={12} aria-hidden="true" />{formatDate(r.echeance, locale)}</span>}
                {r.type === 'ACCEPTATION_RISQUE' && r.niveauRisqueMaintenu && (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <ShieldAlert size={12} aria-hidden="true" />{c.registreNiveauMaintenu}{r.niveauRisque ? ` — ${r.niveauRisque}` : ''}
                  </span>
                )}
              </div>
            </div>
            {canEdit && (
              <button type="button" onClick={() => supprimer(r.id)} title={u.cancel}
                className="text-gray-400 hover:text-red-600 shrink-0"><Trash2 size={15} aria-hidden="true" /></button>
            )}
          </li>
        ))}
      </ul>
      )}
    </div>
  )
}
