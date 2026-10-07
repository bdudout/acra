'use client'

// ─── Graphique annuel d'un plan d'audit ou de contrôle (frise des 12 mois) ────
// Une ligne par audit ou contrôle prévu : barre de la période prévue (lib/planification.positionFrise), couleur selon la
// priorité, barre hachurée si la ligne est reportée ou annulée ; repère du jour. Réutilisé par la vue globale (lot P5).
import { positionFrise } from '@/lib/planification'
import { useTranslation } from '@/lib/i18n/context'

export interface LigneFrise { id: string; intitule: string; debut: string | null; fin: string | null; priorite: number | null; statutManuel: string | null; groupe?: string }

const COULEUR_PRIORITE: Record<number, string> = { 1: 'bg-red-500', 2: 'bg-orange-500', 3: 'bg-ebios-500', 4: 'bg-gray-400' }

export default function PlanFrise({ annee, lignes, titre }: { annee: number; lignes: LigneFrise[]; titre?: string }) {
  const { t, locale } = useTranslation()
  const p = t.plans
  const mois = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(annee, i, 1)).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }))
  const aujourdhui = new Date()
  const repere = aujourdhui.getUTCFullYear() === annee ? positionFrise(aujourdhui.toISOString().slice(0, 10), null, annee) : null
  const sansDate = lignes.filter(l => !l.debut)

  return (
    <figure className="card p-4" aria-label={titre ?? p.frise.titre.replace('{annee}', String(annee))}>
      <figcaption className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">{titre ?? p.frise.titre.replace('{annee}', String(annee))}</figcaption>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[minmax(10rem,14rem)_1fr] text-[11px] text-gray-500 dark:text-gray-400">
            <span />
            <div className="grid grid-cols-12 border-b border-gray-200 dark:border-gray-700 pb-1">{mois.map(m => <span key={m} className="text-center capitalize">{m}</span>)}</div>
          </div>
          {lignes.filter(l => l.debut).length === 0 && <p className="text-sm italic text-gray-400 py-3">{p.frise.vide}</p>}
          {lignes.filter(l => l.debut).map(l => {
            const pos = positionFrise(l.debut, l.fin, annee)!
            const inactive = l.statutManuel === 'REPORTEE' || l.statutManuel === 'ANNULEE'
            return (
              <div key={l.id} className="grid grid-cols-[minmax(10rem,14rem)_1fr] items-center py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-700 dark:text-gray-200 truncate pr-2" title={l.intitule}>{l.groupe ? <span className="text-gray-400">{l.groupe} · </span> : null}{l.intitule}</span>
                <div className="relative h-5 bg-[repeating-linear-gradient(90deg,transparent,transparent_calc(100%/12_-_1px),rgb(229_231_235)_calc(100%/12_-_1px),rgb(229_231_235)_calc(100%/12))] dark:bg-none">
                  <div
                    className={`absolute top-0.5 h-4 rounded ${COULEUR_PRIORITE[l.priorite ?? 3] ?? 'bg-ebios-500'} ${inactive ? 'opacity-40 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,.6)_4px,rgba(255,255,255,.6)_8px)]' : ''}`}
                    style={{ left: `${pos.gauche}%`, width: `${pos.largeur}%` }}
                    title={`${l.intitule} : ${l.debut}${l.fin && l.fin !== l.debut ? ` → ${l.fin}` : ''}${l.statutManuel ? ` (${(p.statutsManuels as Record<string, string>)[l.statutManuel]})` : ''}`}
                  />
                  {repere && <div className="absolute inset-y-0 w-px bg-red-500/70" style={{ left: `${repere.gauche}%` }} aria-hidden="true" />}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-gray-500 dark:text-gray-400">
        {[1, 2, 3, 4].map(n => <span key={n} className="inline-flex items-center gap-1"><span className={`inline-block w-3 h-2 rounded-sm ${COULEUR_PRIORITE[n]}`} />{p.priorites[String(n) as '1']}</span>)}
        {repere && <span className="inline-flex items-center gap-1"><span className="inline-block w-px h-3 bg-red-500" />{p.frise.aujourdhui}</span>}
        {sansDate.length > 0 && <span>{p.frise.sansDate.replace('{n}', String(sansDate.length))}</span>}
      </div>
    </figure>
  )
}
