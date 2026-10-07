'use client'

// ─── Programme d'audit et de contrôle : un plan ───────────────────────────────
// Onglets par année de l'horizon ; statut et actions du cycle de validation (selon les droits renvoyés par l'API) ;
// graphique annuel (frise des 12 mois) ; lignes multi-prismes (ajout, modification, suppression si l'année est
// modifiable : plan figé en brouillon ou révision, plan dynamique hors soumission) ; historique des transitions et
// version validée. API : /api/plans/[id]/**. Spec : docs/specs/programme-audit-controle.md.
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { peutModifierLignes, type ModePlan, type Prisme, type StatutAnnee, type StatutLigne, type TypePlan } from '@/lib/planification'
import { STATUT_STYLE } from './PlansManager'
import PlanFrise from './PlanFrise'
import LigneForm, { ligneVide, type LigneSaisie, type Options } from './LigneForm'
import RealisationsPanel from './RealisationsPanel'

interface Cibles { organisations?: string[]; tiers?: string[]; risques?: string[]; processus?: string[]; referentiel?: { code: string; exigences: string[] } | null }
interface Ligne {
  id: string; annee: number; intitule: string; prisme: Prisme; cibles: Cibles; echantillon: { methode: string; population: number | null; taille: number | null } | null
  debut: string | null; fin: string | null; charge: number | null; priorite: number | null; responsable: string | null; statutManuel: string | null
  statutCalcule?: StatutLigne; realisations?: { type: string; id: string; statut: string | null; intitule: string | null }[]
}
interface Annee {
  annee: number; statut: StatutAnnee; preparePar: string | null; validePar: string | null; valideLe: string | null; commentaire: string | null
  revision: number; motifRevision: string | null; historique: { action: string; statut: string; par: string; le: string; commentaire?: string; motif?: string }[]
}
interface Donnees {
  plan: { id: string; type: TypePlan; nom: string; equipe: string | null; prismePrincipal: Prisme; mode: ModePlan; anneeDebut: number; anneeFin: number }
  annees: Annee[]; lignes: Ligne[]; droits: { preparer: boolean; valider: boolean; doubleRegard: boolean }
}

const jour = (d: string | null) => (d ? d.slice(0, 10) : null)
const STATUT_LIGNE_STYLE: Record<StatutLigne, string> = {
  REALISEE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  EN_COURS: 'bg-ebios-100 text-ebios-800 dark:bg-ebios-500/15 dark:text-ebios-200',
  EN_RETARD: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  A_VENIR: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  REPORTEE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  ANNULEE: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
}

export default function PlanView({ id }: { id: string }) {
  const { t, locale } = useTranslation()
  const p = t.plans
  const [d, setD] = useState<Donnees | null>(null)
  const [introuvable, setIntrouvable] = useState(false)
  const [annee, setAnnee] = useState<number | null>(null)
  const [options, setOptions] = useState<Options | null>(null)
  const [edition, setEdition] = useState<null | { id: string | null; saisie: LigneSaisie }>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [rattachement, setRattachement] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const r = await fetch(`/api/plans/${id}`).catch(() => null)
    if (!r || !r.ok) { setIntrouvable(true); return }
    const j = await r.json() as Donnees
    setD(j)
    setAnnee(a => a ?? (j.annees.find(x => x.annee === new Date().getFullYear())?.annee ?? j.annees[0]?.annee ?? null))
  }, [id])
  useEffect(() => { reload() }, [reload])
  useEffect(() => { if (edition && !options) fetch('/api/plans/options').then(r => (r.ok ? r.json() : null)).then(setOptions).catch(() => {}) }, [edition, options])

  const erreurTexte = (code?: string) => (p.erreurs as Record<string, string>)[code ?? ''] ?? p.erreurs.defaut
  const courante = d?.annees.find(a => a.annee === annee) ?? null
  const lignes = useMemo(() => (d?.lignes ?? []).filter(l => l.annee === annee).map(l => ({ ...l, debut: jour(l.debut), fin: jour(l.fin) })), [d, annee])

  if (introuvable) return <p className="text-sm text-gray-500">{p.introuvable} <Link href="/plans" className="text-ebios-600 hover:underline">{p.retour}</Link></p>
  if (!d || !courante || annee == null) return <p className="text-sm text-gray-400">…</p>

  const modifiable = d.droits.preparer && peutModifierLignes(courante.statut, d.plan.mode)

  async function transition(action: 'SOUMETTRE' | 'VALIDER' | 'RENVOYER' | 'REVISER') {
    let motif: string | undefined, commentaire: string | undefined
    if (action === 'REVISER') { motif = window.prompt(p.motifRevision) ?? undefined; if (motif === undefined) return }
    if (action === 'VALIDER' || action === 'RENVOYER') commentaire = window.prompt(p.commentaire) ?? undefined
    const r = await fetch(`/api/plans/${id}/annees/${annee}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, motif, commentaire }) }).catch(() => null)
    if (r?.ok) { setMessage(null); reload(); return }
    setMessage(erreurTexte(r ? ((await r.json().catch(() => ({}))) as { error?: string }).error : undefined))
  }

  async function enregistrer(s: LigneSaisie): Promise<string | null> {
    const corps = {
      annee, intitule: s.intitule, prisme: s.prisme, debut: s.debut || null, fin: s.fin || null, charge: s.charge || null, priorite: s.priorite || null,
      responsable: s.responsable || null, statutManuel: s.statutManuel || null, cibles: s.cibles,
      echantillon: s.echantillon.methode ? { methode: s.echantillon.methode, population: s.echantillon.population || null, taille: s.echantillon.taille || null } : null,
    }
    const url = edition?.id ? `/api/plans/${id}/lignes/${edition.id}` : `/api/plans/${id}/lignes`
    const r = await fetch(url, { method: edition?.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }).catch(() => null)
    if (r?.ok) { setEdition(null); reload(); return null }
    return erreurTexte(r ? ((await r.json().catch(() => ({}))) as { error?: string }).error : undefined)
  }

  async function supprimer(l: Ligne) {
    if (!window.confirm(p.confirmerSuppression)) return
    const r = await fetch(`/api/plans/${id}/lignes/${l.id}`, { method: 'DELETE' }).catch(() => null)
    if (r?.ok) reload(); else setMessage(erreurTexte(r ? ((await r.json().catch(() => ({}))) as { error?: string }).error : undefined))
  }

  const versSaisie = (l: Ligne): LigneSaisie => ({
    intitule: l.intitule, prisme: l.prisme, debut: l.debut ?? '', fin: l.fin ?? '', charge: l.charge == null ? '' : String(l.charge),
    priorite: l.priorite == null ? '' : String(l.priorite), responsable: l.responsable ?? '', statutManuel: l.statutManuel ?? '',
    cibles: { organisations: l.cibles.organisations ?? [], tiers: l.cibles.tiers ?? [], risques: l.cibles.risques ?? [], processus: l.cibles.processus ?? [], referentiel: l.cibles.referentiel ?? null },
    echantillon: { methode: l.echantillon?.methode ?? '', population: l.echantillon?.population == null ? '' : String(l.echantillon.population), taille: l.echantillon?.taille == null ? '' : String(l.echantillon.taille) },
  })
  const resumeCibles = (c: Cibles) => [
    c.organisations?.length ? `${p.organisations} ${c.organisations.length}` : null, c.tiers?.length ? `${p.tiers} ${c.tiers.length}` : null,
    c.risques?.length ? `${p.risques} ${c.risques.length}` : null, c.processus?.length ? `${p.processus} ${c.processus.length}` : null,
    c.referentiel ? `${c.referentiel.code}${c.referentiel.exigences.length ? ` (${c.referentiel.exigences.length})` : ''}` : null,
  ].filter(Boolean).join(' · ') || '—'
  const statut = courante.statut
  const actions: ('SOUMETTRE' | 'VALIDER' | 'RENVOYER' | 'REVISER')[] = []
  if (d.droits.preparer && (statut === 'BROUILLON' || statut === 'REVISION' || (statut === 'VALIDE' && d.plan.mode === 'DYNAMIQUE'))) actions.push('SOUMETTRE')
  if (d.droits.valider && statut === 'SOUMIS') actions.push('VALIDER', 'RENVOYER')
  if (d.droits.preparer && statut === 'VALIDE') actions.push('REVISER')
  const date = (s: string | null) => (s ? new Date(s).toLocaleDateString(locale) : '—')

  return (
    <div className="space-y-5">
      <header>
        <Link href="/plans" className="text-xs text-ebios-600 hover:underline">{p.retour}</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{d.plan.nom}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{[d.plan.type === 'AUDIT' ? t.planification.planAudit : t.planification.planControle, d.plan.equipe, p.prismes[d.plan.prismePrincipal], p.modes[d.plan.mode], `${d.plan.anneeDebut}–${d.plan.anneeFin}`].filter(Boolean).join(' · ')}</p>
      </header>

      <div role="tablist" aria-label={p.annee} className="flex flex-wrap gap-1.5">
        {d.annees.map(a => (
          <button key={a.annee} role="tab" aria-selected={a.annee === annee} onClick={() => { setAnnee(a.annee); setEdition(null) }}
            className={`px-3 py-1.5 rounded-lg text-sm border ${a.annee === annee ? 'border-ebios-500 bg-ebios-50 text-ebios-800 dark:bg-ebios-500/15 dark:text-ebios-100' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}>
            {a.annee} <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${STATUT_STYLE[a.statut]}`}>{p.statuts[a.statut]}</span>
          </button>
        ))}
      </div>

      <section className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-700 dark:text-gray-200">
          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUT_STYLE[statut]}`}>{p.statuts[statut]}</span>
          {courante.valideLe && <span className="ml-2 text-xs text-gray-500">{p.valideLe.replace('{date}', date(courante.valideLe))}{courante.revision ? ` · ${p.revisionN.replace('{n}', String(courante.revision))}` : ''}</span>}
          {!modifiable && d.droits.preparer && <p className="text-xs text-gray-500 mt-1">{p.verrouille}</p>}
          {d.droits.doubleRegard && <p className="text-xs text-gray-500 mt-1">{p.doubleRegardActif}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map(a => <button key={a} type="button" onClick={() => transition(a)} className={a === 'VALIDER' || a === 'SOUMETTRE' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}>{p.actions[a]}</button>)}
        </div>
        {message && <p role="alert" className="w-full text-sm text-red-600">{message}</p>}
      </section>

      <PlanFrise annee={annee} lignes={lignes} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{p.lignesTitre.replace('{annee}', String(annee))}</h2>
          {modifiable && !edition && <button type="button" onClick={() => setEdition({ id: null, saisie: ligneVide(d.plan.prismePrincipal) })} className="btn-secondary text-sm inline-flex items-center gap-1"><Plus size={14} aria-hidden="true" />{p.ajouterLigne}</button>}
        </div>
        {edition && (options ? <LigneForm key={edition.id ?? 'nouvelle'} initial={edition.saisie} options={options} annee={annee} onSave={enregistrer} onCancel={() => setEdition(null)} /> : <p className="text-sm text-gray-400">…</p>)}
        {lignes.length === 0 ? <p className="text-sm italic text-gray-400">{p.aucuneLigne}</p> : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2">{p.intitule}</th><th className="px-3 py-2">{p.prisme}</th><th className="px-3 py-2">{p.cibles}</th>
                <th className="px-3 py-2">{p.periode}</th><th className="px-3 py-2">{p.rattachement.colonne}</th><th className="px-3 py-2">{p.charge}</th><th className="px-3 py-2">{p.responsable}</th><th className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {lignes.map(l => (
                  <tr key={l.id} className="border-b border-gray-100 dark:border-gray-800 align-top">
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-100">{l.intitule}{l.statutManuel && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{(p.statutsManuels as Record<string, string>)[l.statutManuel]}</span>}</td>
                    <td className="px-3 py-2 text-xs">{p.prismes[l.prisme]}</td>
                    <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{resumeCibles(l.cibles)}{l.echantillon ? <span className="block text-gray-400">{p.methodes[l.echantillon.methode as 'EXHAUSTIF']}{l.echantillon.taille ? ` · ${l.echantillon.taille}/${l.echantillon.population ?? '?'}` : ''}</span> : null}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{l.debut ? `${date(l.debut)}${l.fin && l.fin !== l.debut ? ` → ${date(l.fin)}` : ''}` : '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      {l.statutCalcule && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUT_LIGNE_STYLE[l.statutCalcule]}`}>{p.statutsLigne[l.statutCalcule]}</span>}
                      {(l.realisations ?? []).filter(x => x.intitule).map(x => <span key={`${x.type}:${x.id}`} className="block text-gray-500 dark:text-gray-400 mt-0.5">{x.intitule}</span>)}
                      {d.droits.preparer && <button type="button" onClick={() => setRattachement(rattachement === l.id ? null : l.id)} className="block text-ebios-600 hover:underline mt-0.5">{p.rattachement.rattacher}</button>}
                    </td>
                    <td className="px-3 py-2 text-xs">{l.charge ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">{l.responsable ?? '—'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {modifiable && <>
                        <button type="button" aria-label={`${p.modifier} ${l.intitule}`} onClick={() => setEdition({ id: l.id, saisie: versSaisie(l) })} className="p-1 text-gray-400 hover:text-ebios-600"><Pencil size={14} aria-hidden="true" /></button>
                        <button type="button" aria-label={`${p.supprimer} ${l.intitule}`} onClick={() => supprimer(l)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} aria-hidden="true" /></button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rattachement && <RealisationsPanel key={rattachement} planId={id} ligneId={rattachement} onClose={modifie => { setRattachement(null); if (modifie) reload() }} />}
      </section>

      {courante.historique.length > 0 && (
        <section className="card p-4">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">{p.historique}</h2>
          <ol className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
            {[...courante.historique].reverse().map((h, i) => (
              <li key={i}>{date(h.le)} — {(p.actions as Record<string, string>)[h.action] ?? h.action} → {(p.statuts as Record<string, string>)[h.statut] ?? h.statut}{h.motif ? ` · ${h.motif}` : ''}{h.commentaire ? ` · ${h.commentaire}` : ''}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
