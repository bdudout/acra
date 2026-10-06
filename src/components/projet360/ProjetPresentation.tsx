'use client'
// ─── Page de présentation d'un projet 360 (/projets/[id]) ─────────────────────
// Description (secteur, architecture, périmètre, objectifs), indicateurs (risques et plans d'action — lib/projet-indicateurs),
// matrice brut / actuel / résiduel filtrable par catégorie, répartition par niveau, principaux risques, plans d'action
// par priorité ; date de mise en service (modifiable), validation du projet (soumission / approbation, acceptation des
// résiduels — mêmes panneaux que l'analyse), analyses cyber liées (risques à traiter non importés), export PowerPoint.
// « Modifier » ouvre le mode édition (phases du projet). Données calculées côté serveur (lib/projet-synthese).

import { useState, type ComponentProps } from 'react'
import Link from 'next/link'
import { Download, Pencil } from 'lucide-react'
import AccessPanel from '@/components/AccessPanel'
import ResidualRisksPanel from '@/components/ResidualRisksPanel'
import type { CyberLie } from '@/lib/projet-cyber-lies'
import { useTranslation } from '@/lib/i18n/context'
import { patternLabel } from '@/lib/patterns-archi'
import PlansParPriorite from '@/components/projet360/PlansParPriorite'
import VueAnalyseProjet from '@/components/VueAnalyseProjet'
import MatriceProjet, { type RisqueMatrice } from '@/components/projet360/MatriceProjet'
import type { PalierSynthese } from '@/lib/projet-synthese'
import type { IndicateursProjet } from '@/lib/projet-indicateurs'
import type { ScaleConfig } from '@/lib/risk-scale'

export interface ProjetVue {
  id: string; nom: string; statut: string; secteur: string | null; patterns: string[]
  perimetre: string | null; objectifs: string | null; analyses: { id: string; nom: string }[]
  synthese: { total: number; aTraiter: number; acceptables: number; paliers: PalierSynthese[]
    principaux: { id: string; nom: string; niveau: number; domaine: string | null; palier: { label: string; couleur: string } }[] }
  matrice: RisqueMatrice[]
  scale: Partial<ScaleConfig> | null
  indicateurs: IndicateursProjet
  /** Date de mise en service (AAAA-MM-JJ, Analyse.dateEcheance) ou null. */
  miseEnService?: string | null
  /** Analyses cyber liées accessibles : risques à traiter non importés. */
  cyberLies?: CyberLie[]
}

export interface ValidationProjet { access: ComponentProps<typeof AccessPanel>; residuels?: ComponentProps<typeof ResidualRisksPanel> }

export default function ProjetPresentation({ projet: p, canEdit, canCreateCyber, validation }: { projet: ProjetVue; canEdit: boolean; canCreateCyber: boolean; validation?: ValidationProjet }) {
  const { t, locale } = useTranslation()
  const l = t.projet360.presentation
  const domaines = t.projet360.domaines as Record<string, string>
  const statuts = t.statusLabels as Record<string, string>
  const max = Math.max(1, ...p.synthese.paliers.flatMap(x => [x.brut, x.actuel, x.residuel]))
  const etapes = [['brut', l.brut, 1], ['actuel', l.actuel, 0.7], ['residuel', l.residuel, 0.4]] as const
  const ind = p.indicateurs
  const [mes, setMes] = useState(p.miseEnService ?? '')
  const [mesMsg, setMesMsg] = useState<string | null>(null)
  async function enregistrerMiseEnService(v: string) {
    setMes(v); setMesMsg(null)
    const res = await fetch(`/api/analyses/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dateEcheance: v || null }) }).catch(() => null)
    setMesMsg(res?.ok ? l.dateEnregistree : l.dateErreur)
  }
  // Indicateur : valeur mise en avant (ambre si elle appelle une action) et précision facultative.
  const kpi = (label: string, valeur: React.ReactNode, o: { sous?: React.ReactNode; alerte?: boolean } = {}) => (
    <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${o.alerte ? 'text-amber-700 dark:text-amber-300' : 'text-gray-900 dark:text-gray-100'}`}>{valeur}</p>
      {o.sous && <p className="text-xs text-gray-500 dark:text-gray-400">{o.sous}</p>}
    </div>
  )
  return (
    <div className="space-y-6">
      <VueAnalyseProjet active="projet" projet={{ id: p.id, nom: p.nom }} analyses={p.analyses} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/projets" className="text-sm text-ebios-700 hover:underline">{l.retour}</Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{p.nom}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{statuts[p.statut] ?? p.statut}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/projets/${p.id}/export?lang=${locale}`} className="btn-secondary text-sm inline-flex items-center gap-1.5"><Download size={14} aria-hidden="true" />{l.exportPptx}</a>
          {canCreateCyber && <Link href={`/analyses/new?projet=${p.id}`} className="btn-secondary text-sm">{l.lancerCyber}</Link>}
          {canEdit && <Link href={`/analyses/${p.id}/atelier/1?phase=contexte`} className="btn-primary text-sm inline-flex items-center gap-1.5"><Pencil size={14} aria-hidden="true" />{l.modifier}</Link>}
        </div>
      </div>

      <section className="card p-5 grid gap-4 sm:grid-cols-2">
        <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400">{l.secteur}</p><p className="text-sm text-gray-800 dark:text-gray-100">{p.secteur ?? l.nonRenseigne}</p></div>
        <div>
          {canEdit
            ? <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{l.miseEnService}
                <input type="date" aria-label={l.miseEnService} value={mes} onChange={e => enregistrerMiseEnService(e.target.value)} className="mt-0.5 block rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800" />
              </label>
            : <><p className="text-xs font-medium text-gray-500 dark:text-gray-400">{l.miseEnService}</p><p className="text-sm text-gray-800 dark:text-gray-100">{mes ? new Date(`${mes}T00:00:00`).toLocaleDateString(locale) : l.nonDefinie}</p></>}
          {mesMsg && <p role="status" className="text-xs text-gray-500">{mesMsg}</p>}
        </div>
        <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400">{l.patterns}</p>
          {p.patterns.length ? <ul className="flex flex-wrap gap-1.5">{p.patterns.map(c => <li key={c} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700/50 dark:text-gray-200">{patternLabel(c, locale)}</li>)}</ul> : <p className="text-sm text-gray-400">{l.nonRenseigne}</p>}
        </div>
        <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400">{l.perimetre}</p><p className="whitespace-pre-line text-sm text-gray-800 dark:text-gray-100">{p.perimetre || l.nonRenseigne}</p></div>
        <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400">{l.objectifs}</p><p className="whitespace-pre-line text-sm text-gray-800 dark:text-gray-100">{p.objectifs || l.nonRenseigne}</p></div>
        {p.analyses.length > 0 && <div className="sm:col-span-2"><p className="text-xs font-medium text-gray-500 dark:text-gray-400">{l.analysesLiees}</p>
          <ul className="text-sm">{p.analyses.map(a => <li key={a.id}><Link href={`/analyses/${a.id}`} className="text-ebios-700 hover:underline">{a.nom}</Link></li>)}</ul></div>}
      </section>

      <section className="card p-5" aria-label={l.indicateurs}>
        <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">{l.indicateurs}</h2>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{l.indRisques}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {kpi(l.risques, p.synthese.total)}
          {kpi(l.aTraiter, p.synthese.aTraiter, { sous: `${l.acceptables} ${p.synthese.acceptables}` })}
          {kpi(l.sansPlan, ind.risquesATraiterSansPlan, { alerte: ind.risquesATraiterSansPlan > 0 })}
          {kpi(l.reduction, ind.reductionPct == null ? l.nd : ind.reductionPct > 0 ? `-${ind.reductionPct} %` : `${ind.reductionPct} %`)}
          {kpi(l.horsAppetit, ind.residuelsHorsAppetit, { alerte: ind.residuelsHorsAppetit > 0 })}
        </div>
        <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{l.indPlans}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">{l.avancement}</p>
            <p className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{ind.plans.avancement == null ? l.nd : `${ind.plans.avancement} %`}</p>
            {ind.plans.avancement != null && <div className="mt-1 h-1.5 rounded bg-gray-100 dark:bg-gray-800" aria-hidden="true"><div className="h-1.5 rounded bg-ebios-600" style={{ width: `${ind.plans.avancement}%` }} /></div>}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{l.avancementSous.replace('{faits}', String(ind.plans.faits)).replace('{total}', String(ind.plans.total))}</p>
          </div>
          {kpi(l.enRetard, ind.plans.enRetard, { alerte: ind.plans.enRetard > 0 })}
          {kpi(l.echeanceProche, ind.plans.echeanceProche)}
          {kpi(l.sansPorteur, ind.plans.sansPorteur, { alerte: ind.plans.sansPorteur > 0 })}
          {kpi(l.sansEcheance, ind.plans.sansEcheance, { alerte: ind.plans.sansEcheance > 0 })}
          {ind.miseEnService && kpi(l.indMiseEnService, (ind.miseEnService.joursRestants >= 0 ? l.jours : l.joursPasses).replace('{n}', String(Math.abs(ind.miseEnService.joursRestants))), { sous: ind.miseEnService.plansApres ? l.plansApres.replace('{n}', String(ind.miseEnService.plansApres)) : undefined, alerte: ind.miseEnService.plansApres > 0 })}
        </div>
      </section>

      {(validation || (p.cyberLies?.length ?? 0) > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {validation && (
            <section className="space-y-3" aria-label={l.validation}>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{l.validation}</h2>
              <AccessPanel {...validation.access} />
              {validation.residuels && <ResidualRisksPanel {...validation.residuels} />}
            </section>
          )}
          {(p.cyberLies?.length ?? 0) > 0 && (
            <section className="card p-5" aria-label={l.cyberLies}>
              <h2 className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-100">{l.cyberLies}</h2>
              <ul className="space-y-2 text-sm">
                {p.cyberLies!.map(a => (
                  <li key={a.id}>
                    <Link href={`/analyses/${a.id}`} className="font-medium text-ebios-700 hover:underline">{a.nom}</Link>
                    {a.aImporter > 0
                      ? <p className="text-xs text-amber-700 dark:text-amber-300"><span>{l.aImporter.replace('{n}', String(a.aImporter))}</span>{a.exemples.length > 0 && <span className="text-gray-500"> — {a.exemples.join(' · ')}</span>}</p>
                      : <p className="text-xs text-gray-500">{l.aJour}</p>}
                  </li>
                ))}
              </ul>
              {canEdit && p.cyberLies!.some(a => a.aImporter > 0) && <Link href={`/analyses/${p.id}/atelier/1?phase=qualification`} className="btn-secondary mt-3 inline-block text-sm">{l.importer}</Link>}
            </section>
          )}
        </div>
      )}

      {p.matrice.length > 0 && <MatriceProjet risques={p.matrice} scale={p.scale} />}

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
          </div>
        </div>
      )}
      <PlansParPriorite analyseId={p.id} editable={canEdit} miseEnService={mes || null} />
    </div>
  )
}
