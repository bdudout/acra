'use client'
// ─── Entités de tiers : import depuis les services tiers des analyses ─────────
// Services tiers (parties prenantes regroupées par nom) sans entité, de type fournisseur, prestataire ou partenaire : rattacher à une entité candidate (nom ou alias,
// proposée, jamais appliquée sans clic) ou créer l'entité correspondante, qui reprend alors ces occurrences.

import { useTranslation } from '@/lib/i18n/context'
import { TYPES_ENTITE_PROBABLE, type ServiceTiers } from '@/lib/services-tiers'

export default function ImportServicesTiers({ services, canManage, busy, onRattacher, onCreer }: {
  services: readonly ServiceTiers[]; canManage: boolean; busy: boolean
  onRattacher: (partieIds: string[], tierId: string) => void
  onCreer: (service: ServiceTiers) => void
}) {
  const { t } = useTranslation()
  const c = t.tierIdentity
  // Fournisseurs, prestataires et partenaires seulement : clients et acteurs internes ne sont pas des entités à créer.
  const libres = services.filter(s => s.aRattacher.length > 0 && TYPES_ENTITE_PROBABLE.has(s.type))
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{c.importTitre}</h3>
      <p className="text-xs text-gray-600 dark:text-gray-300">{libres.length ? c.importHint.replace('{n}', String(libres.length)) : c.importVide}</p>
      {libres.length > 0 && (
        <ul className="mt-2 space-y-2">
          {libres.map(s => (
            <li key={s.key} className="rounded-sm border border-gray-200 p-2 text-sm dark:border-gray-700">
              <p className="text-gray-900 dark:text-gray-100"><span className="font-medium">{s.nom}</span>
                <span className="ml-2 text-xs text-gray-500">{c.occurrences.replace('{n}', String(s.aRattacher.length)).replace('{a}', String(s.analyses.length))}</span></p>
              {canManage && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {s.candidats.map(x => (
                    <span key={x.tierId} className="inline-flex items-center gap-1">
                      <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => onRattacher(s.aRattacher, x.tierId)}>{c.rattacherA.replace('{name}', x.nom)}</button>
                      <span className="text-xs text-gray-500">({c.reasons[x.reason]})</span>
                    </span>
                  ))}
                  <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => onCreer(s)}>{c.creerEntite}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
