'use client'
// ─── Page de présentation d'un projet 360 (/projets/[id]) ─────────────────────
// Description (secteur, architecture, périmètre, objectifs), indicateurs, répartition des risques par niveau aux trois
// étapes (brut / actuel / résiduel), risques par domaine, principaux risques, plans d'action par priorité ; « Modifier »
// ouvre le mode édition (phases du projet). Données calculées côté serveur (lib/projet-synthese) : lecture seule.

import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { patternLabel } from '@/lib/patterns-archi'
import PlansParPriorite from '@/components/projet360/PlansParPriorite'
import type { PalierSynthese } from '@/lib/projet-synthese'

export interface ProjetVue {
  id: string; nom: string; statut: string; secteur: string | null; patterns: string[]
  perimetre: string | null; objectifs: string | null; analyses: { id: string; nom: string }[]
  synthese: { total: number; aTraiter: number; acceptables: number; paliers: PalierSynthese[]
    principaux: { id: string; nom: string; niveau: number; domaine: string | null; palier: { label: string; couleur: string } }[] }
  parDomaine: { domaine: string; total: number; aTraiter: number }[]
  plans: { ouverts: number; enRetard: number }
}

export default function ProjetPresentation({ projet: p, canEdit, canCreateCyber }: { projet: ProjetVue; canEdit: boolean; canCreateCyber: boolean }) {
  const { t, locale } = useTranslation()
  const l = t.projet360.presentation
  const domaines = t.projet360.domaines as Record<string, string>
  const statuts = t.statusLabels as Record<string, string>
  const max = Math.max(1, ...p.synthese.paliers.flatMap(x => [x.brut, x.actuel, x.residuel]))
  const etapes = [['brut', l.brut, 1], ['actuel', l.actuel, 0.7], ['residuel', l.residuel, 0.4]] as const
  const kpi = (label: string, valeur: React.ReactNode, sous?: React.ReactNode) => (
    <div className="card p-4"><p className="text-xs text-gray-500 dark:text-gray-400">{label}</p><p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{valeur}</p>{sous && <p className="text-xs text-gray-500 dark:text-gray-400">{sous}</p>}</div>
  )
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/projets" className="text-sm text-ebios-700 hover:underline">{l.retour}</Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{p.nom}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{statuts[p.statut] ?? p.statut}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreateCyber && <Link href={`/analyses/new?projet=${p.id}`} className="btn-secondary text-sm">{l.lancerCyber}</Link>}
          {canEdit && <Link href={`/analyses/${p.id}/atelier/1?phase=contexte`} className="btn-primary text-sm inline-flex items-center gap-1.5"><Pencil size={14} aria-hidden="true" />{l.modifier}</Link>}
        </div>
      </div>

      <section className="card p-5 grid gap-4 sm:grid-cols-2">
        <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400">{l.secteur}</p><p className="text-sm text-gray-800 dark:text-gray-100">{p.secteur ?? l.nonRenseigne}</p></div>
        <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400">{l.patterns}</p>
          {p.patterns.length ? <ul className="flex flex-wrap gap-1.5">{p.patterns.map(c => <li key={c} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700/50 dark:text-gray-200">{patternLabel(c, locale)}</li>)}</ul> : <p className="text-sm text-gray-400">{l.nonRenseigne}</p>}
        </div>
        <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400">{l.perimetre}</p><p className="whitespace-pre-line text-sm text-gray-800 dark:text-gray-100">{p.perimetre || l.nonRenseigne}</p></div>
        <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400">{l.objectifs}</p><p className="whitespace-pre-line text-sm text-gray-800 dark:text-gray-100">{p.objectifs || l.nonRenseigne}</p></div>
        {p.analyses.length > 0 && <div className="sm:col-span-2"><p className="text-xs font-medium text-gray-500 dark:text-gray-400">{l.analysesLiees}</p>
          <ul className="text-sm">{p.analyses.map(a => <li key={a.id}><Link href={`/analyses/${a.id}`} className="text-ebios-700 hover:underline">{a.nom}</Link></li>)}</ul></div>}
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpi(l.risques, p.synthese.total)}
        {kpi(l.aTraiter, p.synthese.aTraiter)}
        {kpi(l.acceptables, p.synthese.acceptables)}
        {kpi(l.plansOuverts, p.plans.ouverts, `${l.plansEnRetard} ${p.plans.enRetard}`)}
      </div>

      {p.synthese.total === 0 ? <p className="card p-5 text-sm italic text-gray-500">{l.aucunRisque}</p> : (
        <div className="grid gap-5 lg:grid-cols-2">
          <figure className="card p-5" aria-label={l.repartition} role="figure">
            <figcaption className="text-base font-semibold text-gray-900 dark:text-gray-100">{l.repartition}</figcaption>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{l.repartitionHint}</p>
            <div className="space-y-3">
              {[...p.synthese.paliers].reverse().map(pal => (
                <div key={pal.label}>
                  <p className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-200">{pal.label}</p>
                  {etapes.map(([k, lib, op]) => (
                    <div key={k} className="flex items-center gap-2 text-xs">
                      <span className="w-16 shrink-0 text-gray-500 dark:text-gray-400">{lib}</span>
                      <span role="img" aria-label={`${pal.label} — ${lib} : ${pal[k]}`} className="h-3 rounded" style={{ width: `${(pal[k] / max) * 100}%`, minWidth: pal[k] ? '0.5rem' : 0, backgroundColor: pal.couleur, opacity: op }} />
                      <span className="tabular-nums text-gray-600 dark:text-gray-300">{pal[k]}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </figure>
          <div className="space-y-5">
            <section className="card p-5" aria-label={l.principaux}>
              <h2 className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">{l.principaux}</h2>
              <ul className="space-y-1.5 text-sm">
                {p.synthese.principaux.map(r => (
                  <li key={r.id} className="flex items-center gap-2">
                    <span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.palier.couleur }} />
                    <span className="flex-1 text-gray-800 dark:text-gray-100">{r.nom}</span>
                    {r.domaine && <span className="text-xs text-gray-400">{domaines[r.domaine] ?? r.domaine}</span>}
                    <span className="text-xs tabular-nums text-gray-500">{r.palier.label} · {r.niveau}</span>
                  </li>
                ))}
              </ul>
            </section>
            {p.parDomaine.length > 0 && <section className="card p-5" aria-label={l.parDomaine}>
              <h2 className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">{l.parDomaine}</h2>
              <ul className="space-y-1 text-sm">
                {p.parDomaine.map(d => <li key={d.domaine} className="flex justify-between gap-2"><span className="text-gray-700 dark:text-gray-200">{domaines[d.domaine] ?? d.domaine}</span><span className="tabular-nums text-gray-500">{d.total}{d.aTraiter ? ` · ${l.aTraiter.toLowerCase()} ${d.aTraiter}` : ''}</span></li>)}
              </ul>
            </section>}
          </div>
        </div>
      )}
      <PlansParPriorite analyseId={p.id} />
    </div>
  )
}
