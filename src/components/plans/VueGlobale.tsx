'use client'

// ─── Programme d'audit et de contrôle : vue globale de tous les plans (lot P5) ─
// Année choisie : synthèse par plan, frise commune (une ligne par audit ou contrôle, préfixée par son plan), entités,
// filiales et tiers sollicités plusieurs fois (en même temps en tête), angles morts (risques critiques ou majeurs,
// processus critiques ou importants non couverts depuis le seuil configuré). API : /api/plans/vue.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CalendarClock } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import type { StatutAnnee } from '@/lib/planification'
import type { AngleMortProcessus, AngleMortRisque, LigneVue, Sollicitation } from '@/lib/planification-vue'
import PlanFrise from './PlanFrise'
import { STATUT_STYLE } from './PlansManager'

interface Vue {
  annee: number; seuilAnglesMortsAns: number
  plans: { id: string; nom: string; type: 'AUDIT' | 'CONTROLE'; equipe: string | null; statut: StatutAnnee | null; lignes: number; annulees: number; reportees: number; realisation?: { actives: number; realisees: number; enRetard: number; taux: number | null } }[]
  lignes: LigneVue[]
  sollicitations: { organisations: Sollicitation[]; tiers: Sollicitation[] }
  anglesMorts: { risques: AngleMortRisque[]; processus: AngleMortProcessus[] }
}

/** Liste des cibles sollicitées plusieurs fois (définie hors du rendu de VueGlobale). */
function ListeSollicitations({ titre, items, v, periode }: { titre: string; items: Sollicitation[]; v: { aucuneSollicitation: string; nombreFois: string; simultanee: string }; periode: (l: { debut: string | null; fin: string | null }) => string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">{titre}</h3>
      {items.length === 0 ? <p className="text-sm italic text-gray-400">{v.aucuneSollicitation}</p> : (
        <ul className="space-y-2">
          {items.map(s => (
            <li key={s.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                {s.nom} <span className="text-xs text-gray-500">· {v.nombreFois.replace('{n}', String(s.nombre)).replace('{p}', String(s.plans))}</span>
                {s.simultanee && <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">{v.simultanee}</span>}
              </p>
              <ul className="mt-1 text-xs text-gray-600 dark:text-gray-300 space-y-0.5">
                {s.lignes.map(l => <li key={l.ligneId}>{l.planNom} — {l.intitule} · {periode(l)}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function VueGlobale() {
  const { t, locale } = useTranslation()
  const p = t.plans
  const v = p.vue
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [d, setD] = useState<Vue | null>(null)

  useEffect(() => {
    // Réponse d'une année précédemment choisie : ignorée (pas d'écrasement par une requête plus lente).
    let actuelle = true
    setD(null)
    fetch(`/api/plans/vue?annee=${annee}`).then(r => (r.ok ? r.json() : null)).then(j => { if (actuelle) setD(j) }).catch(() => {})
    return () => { actuelle = false }
  }, [annee])

  const date = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC' }) : v.jamais)
  const periode = (l: { debut: string | null; fin: string | null }) => (l.debut ? `${date(l.debut)}${l.fin && l.fin !== l.debut ? ` → ${date(l.fin)}` : ''}` : '—')


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <label className="text-sm text-gray-700 dark:text-gray-200">{p.annee}
          <select aria-label={p.annee} value={annee} onChange={e => setAnnee(Number(e.target.value))} className="ml-2 rounded-sm border border-gray-300 bg-white px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600">
            {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 2 + i).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <a href={`/api/plans/vue/export?annee=${annee}&lang=${locale}`} className="btn-secondary text-sm">{p.export.excel}</a>
        <button type="button" onClick={() => window.print()} className="btn-secondary text-sm">{p.export.imprimer}</button>
      </div>
      <p className="hidden print:block text-lg font-semibold">{p.titre} — {annee}</p>
      {!d ? <p className="text-sm text-gray-400">…</p> : <>
        <section className="card p-4 overflow-x-auto" aria-label={v.synthese}>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">{v.synthese}</h2>
          {d.plans.length === 0 ? <p className="text-sm italic text-gray-400">{p.aucun}</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2">{p.nom}</th><th className="px-3 py-2">{v.typeCol}</th><th className="px-3 py-2">{p.statutManuel}</th><th className="px-3 py-2">{v.lignesCol}</th><th className="px-3 py-2">{v.realisationCol}</th><th className="px-3 py-2">{v.ecartsCol}</th>
              </tr></thead>
              <tbody>
                {d.plans.map(pl => (
                  <tr key={pl.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2"><Link href={`/plans/${pl.id}`} className="text-ebios-700 dark:text-ebios-300 hover:underline">{pl.nom}</Link>{pl.equipe && <span className="text-xs text-gray-400"> · {pl.equipe}</span>}</td>
                    <td className="px-3 py-2 text-xs">{pl.type === 'AUDIT' ? t.planification.planAudit : t.planification.planControle}</td>
                    <td className="px-3 py-2">{pl.statut ? <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUT_STYLE[pl.statut]}`}>{p.statuts[pl.statut]}</span> : <span className="text-xs text-gray-400">{v.horsHorizon}</span>}</td>
                    <td className="px-3 py-2 text-xs">{pl.lignes}</td>
                    <td className="px-3 py-2 text-xs">{pl.realisation?.taux != null ? v.realisation.replace('{taux}', String(pl.realisation.taux)).replace('{r}', String(pl.realisation.enRetard)) : '—'}</td>
                    <td className="px-3 py-2 text-xs">{pl.reportees || pl.annulees ? v.ecarts.replace('{r}', String(pl.reportees)).replace('{a}', String(pl.annulees)) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <PlanFrise annee={d.annee} titre={v.friseTitre.replace('{annee}', String(d.annee))}
          lignes={[...d.lignes].sort((a, b) => (a.debut ?? '9').localeCompare(b.debut ?? '9')).map(l => ({ id: l.ligneId, intitule: l.intitule, debut: l.debut, fin: l.fin, priorite: l.priorite ?? null, statutManuel: l.statutManuel, groupe: l.planNom }))} />

        <section className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 inline-flex items-center gap-2"><CalendarClock size={16} aria-hidden="true" />{v.sollicitations}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{v.sollicitationsAide}</p>
          <div className="grid md:grid-cols-2 gap-4">
            <ListeSollicitations titre={p.organisations} items={d.sollicitations.organisations} v={v} periode={periode} />
            <ListeSollicitations titre={p.tiers} items={d.sollicitations.tiers} v={v} periode={periode} />
          </div>
        </section>

        <section className="card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 inline-flex items-center gap-2"><AlertTriangle size={16} className="text-amber-600" aria-hidden="true" />{v.anglesMorts.replace('{n}', String(d.seuilAnglesMortsAns))}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{v.anglesMortsAide}</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">{v.risquesCritiques}</h3>
              {d.anglesMorts.risques.length === 0 ? <p className="text-sm italic text-gray-400">{v.aucunAngleMort}</p> : (
                <ul className="space-y-1 text-sm">
                  {d.anglesMorts.risques.map(r => (
                    <li key={r.id} className="flex flex-wrap items-center gap-2">
                      <span className="text-gray-800 dark:text-gray-100">{r.nom}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300">{v.niveau.replace('{n}', String(r.niveau))}</span>
                      <span className="text-xs text-gray-500">{v.derniereCouverture.replace('{date}', date(r.derniere))}</span>
                      {r.prevu && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300">{v.prevu}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">{v.processusCritiques}</h3>
              {d.anglesMorts.processus.length === 0 ? <p className="text-sm italic text-gray-400">{v.aucunAngleMort}</p> : (
                <ul className="space-y-1 text-sm">
                  {d.anglesMorts.processus.map(pr => (
                    <li key={pr.id} className="flex flex-wrap items-center gap-2">
                      <span className="text-gray-800 dark:text-gray-100">{pr.nom}</span>
                      {pr.criticite != null && <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{v.criticite.replace('{n}', String(pr.criticite))}</span>}
                      {(pr.criticiteDora === 'CRITIQUE' || pr.criticiteDora === 'IMPORTANTE') && <span className="text-[11px] px-1.5 py-0.5 rounded bg-ebios-50 text-ebios-800 dark:bg-ebios-500/15 dark:text-ebios-200">{v.dora[pr.criticiteDora]}</span>}
                      <span className="text-xs text-gray-500">{v.derniereCouverture.replace('{date}', date(pr.derniere))}</span>
                      {pr.prevu && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300">{v.prevu}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </>}
    </div>
  )
}
