'use client'

// ─── Programme d'audit et de contrôle : liste des plans ──────────────────────
// Plans d'audit et de contrôle de l'organisation (un par équipe ou spécialité), statut de chaque année de l'horizon,
// création d'un plan par un rôle préparateur. API : /api/plans. Spec : docs/specs/programme-audit-controle.md.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarRange, Plus } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import VueGlobale from './VueGlobale'
import { PRISMES, type ModePlan, type Prisme, type StatutAnnee, type TypePlan } from '@/lib/planification'

interface PlanResume {
  id: string; type: TypePlan; nom: string; equipe: string | null; prismePrincipal: Prisme; mode: ModePlan
  anneeDebut: number; anneeFin: number; annees: { annee: number; statut: StatutAnnee }[]; _count: { lignes: number }
}
interface Liste { plans: PlanResume[]; modules: Record<TypePlan, boolean>; peutCreer: Record<TypePlan, boolean>; modeDefaut: ModePlan }

export const STATUT_STYLE: Record<StatutAnnee, string> = {
  BROUILLON: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  SOUMIS: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  VALIDE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  REVISION: 'bg-ebios-100 text-ebios-800 dark:bg-ebios-500/15 dark:text-ebios-200',
}

export default function PlansManager() {
  const { t } = useTranslation()
  const p = t.plans
  const [data, setData] = useState<Liste | null>(null)
  const [form, setForm] = useState<null | { type: TypePlan; nom: string; equipe: string; prismePrincipal: Prisme; mode: ModePlan; anneeDebut: number; anneeFin: number }>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [onglet, setOnglet] = useState<'plans' | 'vue'>('plans')

  const reload = () => fetch('/api/plans').then(r => (r.ok ? r.json() : null)).then(setData).catch(() => {})
  useEffect(() => { reload() }, [])

  const an = new Date().getFullYear()
  function ouvrir(type: TypePlan) {
    setErreur(null)
    setForm({ type, nom: '', equipe: '', prismePrincipal: type === 'AUDIT' ? 'PROCESSUS' : 'RISQUE', mode: data?.modeDefaut ?? 'FIGE', anneeDebut: an + 1, anneeFin: an + 3 })
  }
  async function creer() {
    if (!form) return
    const r = await fetch('/api/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }).catch(() => null)
    if (r?.ok) { setForm(null); reload(); return }
    const code = r ? ((await r.json().catch(() => ({}))) as { error?: string }).error : undefined
    setErreur((p.erreurs as Record<string, string>)[code ?? ''] ?? p.erreurs.defaut)
  }

  if (!data) return <p className="text-sm text-gray-400">…</p>
  const champ = 'mt-1 block w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600'
  const types = (['AUDIT', 'CONTROLE'] as const).filter(ty => data.modules[ty])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100"><CalendarRange size={24} className="inline align-[-0.16em] mr-2 text-ebios-600" aria-hidden="true" />{p.titre}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{p.sousTitre}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          {types.filter(ty => data.peutCreer[ty]).map(ty => (
            <button key={ty} type="button" onClick={() => ouvrir(ty)} className="btn-primary text-sm inline-flex items-center gap-1.5"><Plus size={15} aria-hidden="true" />{p.nouveau[ty]}</button>
          ))}
        </div>
      </header>

      <div role="tablist" aria-label={p.titre} className="flex gap-1.5 border-b border-gray-200 dark:border-gray-700 print:hidden">
        {(['plans', 'vue'] as const).map(o => (
          <button key={o} role="tab" aria-selected={onglet === o} onClick={() => setOnglet(o)}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${onglet === o ? 'border-ebios-600 text-ebios-700 dark:text-ebios-300 font-medium' : 'border-transparent text-gray-500'}`}>{p.onglets[o]}</button>
        ))}
      </div>
      {onglet === 'vue' && <VueGlobale />}

      {onglet === 'plans' && form && (
        <section className="card p-4 space-y-3" aria-label={p.nouveau[form.type]}>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{p.nouveau[form.type]}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-gray-600 dark:text-gray-300">{p.nom}
              <input aria-label={p.nom} value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} className={champ} />
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{p.equipe}
              <input aria-label={p.equipe} value={form.equipe} onChange={e => setForm({ ...form, equipe: e.target.value })} placeholder={p.equipePh} className={champ} />
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{p.prisme}
              <select aria-label={p.prisme} value={form.prismePrincipal} onChange={e => setForm({ ...form, prismePrincipal: e.target.value as Prisme })} className={champ}>
                {PRISMES.map(pr => <option key={pr} value={pr}>{p.prismes[pr]}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{p.mode}
              <select aria-label={p.mode} value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value as ModePlan })} className={champ}>
                <option value="FIGE">{p.modes.FIGE}</option><option value="DYNAMIQUE">{p.modes.DYNAMIQUE}</option>
              </select>
              {/* Le mode décide du verrouillage après validation : on l'explique ici, pas seulement dans la configuration. */}
              <span className="block mt-1 text-[11px] text-gray-500 dark:text-gray-400">{t.planification.modesAide}</span>
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{p.anneeDebut}
              <input aria-label={p.anneeDebut} type="number" value={form.anneeDebut} onChange={e => setForm({ ...form, anneeDebut: Number(e.target.value) })} className={champ} />
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{p.anneeFin}
              <input aria-label={p.anneeFin} type="number" value={form.anneeFin} onChange={e => setForm({ ...form, anneeFin: Number(e.target.value) })} className={champ} />
            </label>
          </div>
          {erreur && <p role="alert" className="text-sm text-red-600">{erreur}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={creer} className="btn-primary text-sm">{p.creer}</button>
            <button type="button" onClick={() => setForm(null)} className="btn-secondary text-sm">{p.annuler}</button>
          </div>
        </section>
      )}

      {onglet === 'plans' && types.map(ty => {
        const plans = data.plans.filter(pl => pl.type === ty)
        return (
          <section key={ty}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{p.types[ty]}</h2>
            {plans.length === 0 ? <p className="text-sm italic text-gray-400">{p.aucun}</p> : (
              <ul className="grid md:grid-cols-2 gap-3">
                {plans.map(pl => (
                  <li key={pl.id} className="card p-4">
                    <Link href={`/plans/${pl.id}`} className="font-medium text-ebios-700 dark:text-ebios-300 hover:underline">{pl.nom}</Link>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {[pl.equipe, p.prismes[pl.prismePrincipal], p.modes[pl.mode], `${pl.anneeDebut}–${pl.anneeFin}`, p.nbLignes.replace('{n}', String(pl._count.lignes))].filter(Boolean).join(' · ')}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {pl.annees.map(a => <span key={a.annee} className={`text-[11px] px-2 py-0.5 rounded-full ${STATUT_STYLE[a.statut]}`}>{a.annee} · {p.statuts[a.statut]}</span>)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
