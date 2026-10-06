'use client'
// ─── Page de présentation d'un projet 360 (/projets/[id]) ─────────────────────
// Description (secteur, architecture, périmètre, objectifs), indicateurs (risques et plans d'action — lib/projet-indicateurs),
// matrice brut / actuel / résiduel filtrable par catégorie, répartition par niveau, principaux risques, plans d'action
// par priorité ; date de mise en service (modifiable), validation du projet (soumission / approbation, acceptation des
// résiduels — mêmes panneaux que l'analyse), analyses cyber liées (risques à traiter non importés), export PowerPoint.
// « Modifier » ouvre le mode édition (phases du projet). Données calculées côté serveur (lib/projet-synthese).

import { useState, type ComponentProps } from 'react'
import Link from 'next/link'
import { Cloud, CloudLightning, CloudSun, Download, Pencil, Sun, type LucideIcon } from 'lucide-react'
import { METEOS, type Meteo } from '@/lib/projet-meteo'
import PlansRestantsGraphique, { type DonneesRestants } from '@/components/projet360/PlansRestantsGraphique'
import { useRouter } from 'next/navigation'
import AssocierAnalyseCyber from '@/components/projet360/AssocierAnalyseCyber'
import TitreEditable from '@/components/TitreEditable'
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
  /** Libellés des sous-secteurs (le premier est le principal). */
  sousSecteurs?: string[]
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
  /** Météo réglée par le chef de projet (lib/projet-meteo) et date du réglage. */
  meteo?: { valeur: string | null; le: string | null }
  /** Plans d'action restants : prévu par jalons, cible, aujourd'hui (lib/projet-burndown). */
  restants?: DonneesRestants | null
}

const METEO_ICONE: Record<Meteo, LucideIcon> = { SOLEIL: Sun, SOLEIL_NUAGE: CloudSun, NUAGE: Cloud, ORAGE: CloudLightning }
const METEO_COULEUR: Record<Meteo, string> = { SOLEIL: 'text-amber-500', SOLEIL_NUAGE: 'text-amber-400', NUAGE: 'text-gray-500', ORAGE: 'text-red-600' }

export interface ValidationProjet { access: ComponentProps<typeof AccessPanel>; residuels?: ComponentProps<typeof ResidualRisksPanel> }

export default function ProjetPresentation({ projet: p, canEdit, canCreateCyber, validation }: { projet: ProjetVue; canEdit: boolean; canCreateCyber: boolean; validation?: ValidationProjet }) {
  const { t, locale } = useTranslation()
  const l = t.projet360.presentation
  const domaines = t.projet360.domaines as Record<string, string>
  const statuts = t.statusLabels as Record<string, string>
  const max = Math.max(1, ...p.synthese.paliers.flatMap(x => [x.brut, x.actuel, x.residuel]))
  const etapes = [['brut', l.brut, 1], ['actuel', l.actuel, 0.7], ['residuel', l.residuel, 0.4]] as const
  const ind = p.indicateurs
  const router = useRouter()
  const [nom, setNom] = useState(p.nom)
  const meteos = l.meteo as Record<string, string>
  const [meteo, setMeteo] = useState<Meteo | null>((p.meteo?.valeur as Meteo | null) ?? null)
  const [meteoLe, setMeteoLe] = useState<string | null>(p.meteo?.le ?? null)
  async function changerMeteo(v: string) {
    const res = await fetch(`/api/analyses/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meteoProjet: v || null }) }).catch(() => null)
    if (res?.ok) { setMeteo((v || null) as Meteo | null); setMeteoLe(v ? new Date().toISOString() : null) }
  }
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
      <VueAnalyseProjet active="projet" projet={{ id: p.id, nom }} analyses={p.analyses} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/projets" className="text-sm text-ebios-700 hover:underline">{l.retour}</Link>
          <div className="mt-2"><TitreEditable analyseId={p.id} nom={nom} canEdit={canEdit} onRenamed={setNom}
            labels={{ renommer: l.renommer, nom: l.nomProjet, enregistrer: l.enregistrerNom, annuler: l.annuler, erreur: l.nomErreur }} /></div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{statuts[p.statut] ?? p.statut}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/projets/${p.id}/export?lang=${locale}`} className="btn-secondary text-sm inline-flex items-center gap-1.5"><Download size={14} aria-hidden="true" />{l.exportPptx}</a>
          {/* Tant qu'aucune analyse cyber n'est liée : créer une nouvelle analyse ou lier une existante. */}
          {canEdit && p.analyses.length === 0 && <AssocierAnalyseCyber projetId={p.id} canCreate={canCreateCyber} onLinked={() => router.refresh()} />}
          {canEdit && <Link href={`/analyses/${p.id}/atelier/1?phase=contexte`} className="btn-primary text-sm inline-flex items-center gap-1.5"><Pencil size={14} aria-hidden="true" />{l.modifier}</Link>}
        </div>
      </div>

      <section className="card p-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{l.secteur}</p>
          <p className="text-sm text-gray-800 dark:text-gray-100">{p.secteur ?? l.nonRenseigne}</p>
          {(p.sousSecteurs?.length ?? 0) > 0 && (
            <ul aria-label={t.newAnalysis.subSector} className="mt-1 flex flex-wrap gap-1">
              {p.sousSecteurs!.map(s => <li key={s} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">{s}</li>)}
            </ul>
          )}
        </div>
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

      {/* Indicateurs resserrés : météo (chef de projet), mise en service, avancement et retards des plans, risques. */}
      <section className="card p-5" aria-label={l.indicateurs}>
        <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">{l.indicateurs}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">{l.meteoTitre}</p>
            <div className="mt-1 flex items-center gap-2">
              {meteo && (() => { const M = METEO_ICONE[meteo]; return <M size={28} aria-hidden="true" className={METEO_COULEUR[meteo]} /> })()}
              {canEdit
                ? <select aria-label={l.meteoChoisir} value={meteo ?? ''} onChange={e => changerMeteo(e.target.value)} className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-1 py-1 text-xs dark:border-gray-600 dark:bg-gray-800">
                    <option value="">{l.meteoNonRenseignee}</option>
                    {METEOS.map(m => <option key={m} value={m}>{meteos[m]}</option>)}
                  </select>
                : <span className="text-xs font-medium text-gray-800 dark:text-gray-100">{meteo ? meteos[meteo] : l.meteoNonRenseignee}</span>}
            </div>
            {meteoLe && <p className="mt-1 text-[11px] text-gray-400">{l.meteoLe.replace('{date}', new Date(meteoLe).toLocaleDateString(locale))}</p>}
          </div>
          {ind.miseEnService
            ? kpi(l.indMiseEnService, (ind.miseEnService.joursRestants >= 0 ? l.jours : l.joursPasses).replace('{n}', String(Math.abs(ind.miseEnService.joursRestants))), { sous: ind.miseEnService.plansApres ? l.plansApres.replace('{n}', String(ind.miseEnService.plansApres)) : undefined, alerte: ind.miseEnService.plansApres > 0 || ind.miseEnService.joursRestants < 0 })
            : kpi(l.indMiseEnService, l.nonDefinie)}
          <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">{l.avancement}</p>
            <p className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{ind.plans.avancement == null ? l.nd : `${ind.plans.avancement} %`}</p>
            {ind.plans.avancement != null && <div className="mt-1 h-1.5 rounded bg-gray-100 dark:bg-gray-800" aria-hidden="true"><div className="h-1.5 rounded bg-ebios-600" style={{ width: `${ind.plans.avancement}%` }} /></div>}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{l.avancementSous.replace('{faits}', String(ind.plans.faits)).replace('{total}', String(ind.plans.total))}</p>
          </div>
          {kpi(l.enRetard, ind.plans.enRetard, { alerte: ind.plans.enRetard > 0, sous: (ind.plans.sansPorteur || ind.plans.sansEcheance) ? l.sansPorteurEcheance.replace('{p}', String(ind.plans.sansPorteur)).replace('{e}', String(ind.plans.sansEcheance)) : undefined })}
          {kpi(l.sansPlan, ind.risquesATraiterSansPlan, { alerte: ind.risquesATraiterSansPlan > 0, sous: `${l.aTraiter} ${p.synthese.aTraiter} / ${p.synthese.total}` })}
          {kpi(l.horsAppetit, ind.residuelsHorsAppetit, { alerte: ind.residuelsHorsAppetit > 0 })}
        </div>
      </section>

      {/* Matrice des risques puis bandeau des analyses cyber liées à gauche ; validation et partage à droite. */}
      <div className={validation ? 'grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]' : ''}>
        <div className="min-w-0 space-y-3">
          {p.matrice.length > 0 && <MatriceProjet risques={p.matrice} scale={p.scale} />}
          {(p.cyberLies?.length ?? 0) > 0 && (
            <section aria-label={l.cyberLies} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{l.cyberLies}</span>
              {p.cyberLies!.map(a => (
                <span key={a.id} className="inline-flex flex-wrap items-center gap-1.5">
                  <Link href={`/analyses/${a.id}`} className="font-medium text-ebios-700 hover:underline">{a.nom}</Link>
                  {a.aImporter > 0
                    ? <span className="text-xs text-amber-700 dark:text-amber-300" title={a.exemples.join(' · ')}>{l.aImporter.replace('{n}', String(a.aImporter))}</span>
                    : <span className="text-xs text-gray-500">{l.aJour}</span>}
                </span>
              ))}
              {canEdit && p.cyberLies!.some(a => a.aImporter > 0) && <Link href={`/analyses/${p.id}/atelier/1?phase=qualification`} className="ml-auto text-xs font-medium text-ebios-700 hover:underline">{l.importer}</Link>}
            </section>
          )}
        </div>
        {validation && (
          <aside className="space-y-3" aria-label={l.validation} role="region">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{l.validation}</h2>
            <AccessPanel {...validation.access} />
            {validation.residuels && <ResidualRisksPanel {...validation.residuels} />}
          </aside>
        )}
      </div>

      {p.restants && <PlansRestantsGraphique data={p.restants} />}
      <PlansParPriorite analyseId={p.id} editable={canEdit} miseEnService={mes || null} />
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
    </div>
  )
}
