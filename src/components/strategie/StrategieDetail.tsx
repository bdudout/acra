'use client'

// ─── Stratégie cyber / IT / résilience : détail (lot S1b) ────────────────────
// Axes ordonnés avec leurs objectifs (indicateur, cible, échéance, KRI) et leurs éléments rattachés (actions de l'org,
// via /api/actions), modification inline selon le statut : BROUILLON libre ; VALIDEE → cadre figé (contrôles
// désactivés, nouvelle version) ou justifié (boîte de justification) ; rattachements toujours justifiés après
// validation ; ARCHIVEE en lecture. Valider, archiver, nouvelle version selon les droits. Les routes font foi.
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowLeft, ArrowUp, Pencil, Plus, Target, Trash2, X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { STRATEGIE_TYPES, lireIdentifiantsExternes, type IdentifiantExterne, type StrategieType } from '@/lib/strategie'
import { droitsStrategie, libelleValeur, messageErreurStrategie, modeEditionCadre } from '@/lib/strategie-ui'
import type { UserRole } from '@/lib/permissions'
import ConfirmDialog from '@/components/ConfirmDialog'
import JustificationDialog from './JustificationDialog'
import IdentifiantsEditor, { IdentifiantsCompacts, identifiantsPourApi, type IdentifiantsSaisie } from './IdentifiantsEditor'
import StrategieHistorique from './StrategieHistorique'
import { STATUT_STYLE, periodeLisible } from './StrategiesListe'

interface Rattachement { id: string; axeId: string; sourceType: string; sourceId: string; provenance: string }
interface Ids { referenceInterne?: string | null; identifiantsExternes?: unknown }
interface Objectif extends Ids { id: string; axeId: string; titre: string; indicateur: string | null; cible: string | null; echeance: string | null; kriId: string | null }
interface Axe extends Ids { id: string; ordre: number; titre: string; description: string | null; objectifs: Objectif[]; rattachements: Rattachement[] }
interface Strategie {
  id: string; titre: string; type: string; statut: string; version: number; description: string | null
  periodeDebut: string | null; periodeFin: string | null; referenceInterne: string | null; identifiantsExternes: unknown
  valideeLe: string | null; valideeParNom: string | null; axes: Axe[]
}
interface Element { source: string; sourceId: string; titre: string; lien: string | null }

type Edition =
  | { kind: 'axe'; id?: string; titre: string; description: string }
  | { kind: 'objectif'; axeId: string; id?: string; titre: string; indicateur: string; cible: string; echeance: string; kriId: string }
  | { kind: 'strategie'; seulementIds: boolean; titre: string; type: StrategieType; periodeDebut: string; periodeFin: string; description: string; ids: IdentifiantsSaisie }

const ONGLETS = ['cadre', 'historique'] as const
const jour = (d: string | null) => (d ? d.slice(0, 10) : '')
const cle = (sourceType: string, sourceId: string) => `${sourceType}:${sourceId}`

export default function StrategieDetail({ id, role }: { id: string; role: UserRole }) {
  const { t, locale } = useTranslation()
  const s = t.strategie
  const u = s.ui
  const router = useRouter()
  const droits = droitsStrategie(role)
  const [data, setData] = useState<{ strategie: Strategie; cadreFige: boolean } | null>(null)
  const [introuvable, setIntrouvable] = useState(false)
  const [elements, setElements] = useState<Element[]>([])
  const [kris, setKris] = useState<{ id: string; intitule: string }[]>([])
  const [onglet, setOnglet] = useState<'cadre' | 'historique'>('cadre')
  const [erreur, setErreur] = useState<{ msg: string; versionId?: string } | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [dialog, setDialog] = useState<null | { run: (j: string) => void }>(null)
  const [confirm, setConfirm] = useState<null | 'valider' | 'archiver'>(null)
  const [suppression, setSuppression] = useState<null | { message: string; run: () => void }>(null)
  const [edition, setEdition] = useState<Edition | null>(null)
  const [selection, setSelection] = useState<Record<string, string>>({})

  const charger = useCallback(() => {
    fetch(`/api/strategies/${id}`).then(r => (r.ok ? r.json() : null)).then(d => { if (d?.strategie) setData(d); else setIntrouvable(true) }).catch(() => setIntrouvable(true))
  }, [id])
  useEffect(() => {
    charger()
    fetch('/api/actions').then(r => (r.ok ? r.json() : null)).then(d => setElements(d?.items ?? [])).catch(() => {})
    fetch('/api/kri').then(r => (r.ok ? r.json() : null)).then(d => setKris(d?.kris ?? [])).catch(() => {})
  }, [charger])

  const parCle = useMemo(() => new Map(elements.map(e => [cle(e.source, e.sourceId), e])), [elements])
  const titresElements = useMemo(() => new Map(elements.map(e => [cle(e.source, e.sourceId), e.titre])), [elements])

  if (introuvable) return <p role="alert" className="text-sm text-red-600">{s.erreurs.not_found}</p>
  if (!data) return <p className="text-sm text-gray-400">{u.chargement}</p>
  const st = data.strategie
  const mode = modeEditionCadre(st.statut, data.cadreFige)
  const cadreVisible = droits.rediger && mode !== 'lecture'
  const cadreActif = mode === 'libre' || mode === 'justifiee'
  const besoinCadre = mode === 'justifiee'
  const peutRattacher = droits.rattacher && st.statut !== 'ARCHIVEE'
  const besoinRattachement = st.statut === 'VALIDEE'
  // Identifiants internes : modifiables tant que la stratégie n'est pas archivée, même si le cadre est figé.
  const peutIds = droits.rediger && st.statut !== 'ARCHIVEE'
  const typeLib = (s.types as Record<string, string>)[st.type] ?? st.type
  const nomsAxes = new Map(st.axes.map(a => [a.id, a.titre]))

  async function envoyer(url: string, method: string, body?: unknown): Promise<Record<string, unknown> | null> {
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => null)
    const d = (r ? await r.json().catch(() => ({})) : {}) as Record<string, unknown>
    if (r?.ok) return d
    const code = typeof d.error === 'string' ? d.error : undefined
    setErreur({ msg: messageErreurStrategie(code, s.erreurs, u.erreurDefaut), versionId: code === 'version_en_cours' && typeof d.strategieId === 'string' ? d.strategieId : undefined })
    return null
  }
  /**
   * Exécute l'action, après saisie de la justification si elle est exigée, sinon après confirmation si `confirmation`
   * est fourni (suppression en brouillon) ; recharge en cas de succès.
   */
  function executer(besoin: boolean, action: (justif: { justification?: string }) => Promise<Record<string, unknown> | null>, confirmation?: string) {
    setErreur(null); setInfo(null)
    const lancer = async (j?: string) => {
      const ok = await action(j ? { justification: j } : {})
      if (ok) { setEdition(null); charger() }
    }
    if (besoin) setDialog({ run: j => { setDialog(null); void lancer(j) } })
    else if (confirmation) setSuppression({ message: confirmation, run: () => { setSuppression(null); void lancer() } })
    else void lancer()
  }

  /** Déplace un axe (monter / descendre) : renumérote les axes 0..n-1 via le champ `ordre`, une justification pour tous. */
  function deplacer(index: number, delta: -1 | 1) {
    const liste = [...st.axes]
    const cibleIdx = index + delta
    if (cibleIdx < 0 || cibleIdx >= liste.length) return
    ;[liste[index], liste[cibleIdx]] = [liste[cibleIdx], liste[index]]
    const changes = liste.map((a, i) => ({ a, i })).filter(({ a, i }) => a.ordre !== i)
    executer(besoinCadre, async j => {
      let d: Record<string, unknown> | null = {}
      for (const { a, i } of changes) {
        d = await envoyer(`/api/strategies/${id}/axes/${a.id}`, 'PATCH', { ordre: i, ...j })
        if (!d) { charger(); return null }
      }
      return d
    })
  }

  /** Identifiants internes d'un axe ou d'un objectif : sans justification, même cadre figé (tracés par l'API). */
  async function enregistrerIds(url: string, ids: ReturnType<typeof identifiantsPourApi>): Promise<boolean> {
    setErreur(null); setInfo(null)
    const d = await envoyer(url, 'PATCH', ids)
    if (d) charger()
    return !!d
  }

  function enregistrerEdition(e: React.FormEvent) {
    e.preventDefault()
    if (!edition) return
    if (edition.kind === 'axe') {
      const desc = edition.description.trim()
      if (edition.id) {
        const axeId = edition.id
        executer(besoinCadre, j => envoyer(`/api/strategies/${id}/axes/${axeId}`, 'PATCH', { titre: edition.titre, description: desc || null, ...j }))
      } else {
        const ordre = st.axes.reduce((m, a) => Math.max(m, a.ordre + 1), 0)
        executer(besoinCadre, j => envoyer(`/api/strategies/${id}/axes`, 'POST', { titre: edition.titre, ...(desc ? { description: desc } : {}), ordre, ...j }))
      }
    } else if (edition.kind === 'objectif') {
      const champs = { indicateur: edition.indicateur.trim(), cible: edition.cible.trim(), echeance: edition.echeance, kriId: edition.kriId }
      if (edition.id) {
        const objectifId = edition.id
        const body = { titre: edition.titre, ...Object.fromEntries(Object.entries(champs).map(([k, v]) => [k, v || null])) }
        executer(besoinCadre, j => envoyer(`/api/strategies/${id}/objectifs/${objectifId}`, 'PATCH', { ...body, ...j }))
      } else {
        const body = { titre: edition.titre, ...Object.fromEntries(Object.entries(champs).filter(([, v]) => v)) }
        executer(besoinCadre, j => envoyer(`/api/strategies/${id}/axes/${edition.axeId}/objectifs`, 'POST', { ...body, ...j }))
      }
    } else {
      const ids = identifiantsPourApi(edition.ids)
      const body = edition.seulementIds ? ids : {
        titre: edition.titre, type: edition.type, description: edition.description.trim() || null,
        periodeDebut: edition.periodeDebut || null, periodeFin: edition.periodeFin || null, ...ids,
      }
      // Identifiants internes : modifiables même après validation, tracés sans justification obligatoire.
      executer(false, () => envoyer(`/api/strategies/${id}`, 'PATCH', body))
    }
  }

  function rattacher(axeId: string) {
    const v = selection[axeId]
    const el = v ? parCle.get(v) : undefined
    if (!el) return
    executer(besoinRattachement, async j => {
      const d = await envoyer(`/api/strategies/${id}/rattachements`, 'POST', { axeId, sourceType: el.source, sourceId: el.sourceId, ...j })
      if (d) setSelection(p => ({ ...p, [axeId]: '' }))
      return d
    })
  }

  async function transition(quoi: 'valider' | 'archiver') {
    setConfirm(null); setErreur(null); setInfo(null)
    const d = await envoyer(`/api/strategies/${id}/${quoi}`, 'POST')
    if (!d) return
    const liste = (v: unknown) => (Array.isArray(v) ? (v as { axeTitre: string }[]) : [])
    const msg = (gabarit: string, l: { axeTitre: string }[]) => gabarit.replace('{n}', String(l.length)).replace('{axes}', [...new Set(l.map(n => n.axeTitre))].join(', '))
    const ajouts = liste(d.rattachementsNonReportes), retraits = liste(d.retraitsNonReportes)
    const infos = [ajouts.length ? msg(u.nonReportes, ajouts) : '', retraits.length ? msg(u.retraitsNonReportes, retraits) : ''].filter(Boolean)
    if (infos.length) setInfo(infos.join(' '))
    charger()
  }

  /** Onglets ARIA : flèches gauche / droite (et Début / Fin) changent d'onglet et y portent le focus. */
  function clavierOnglets(e: React.KeyboardEvent<HTMLButtonElement>) {
    const i = ONGLETS.indexOf(onglet)
    const cible = e.key === 'ArrowRight' ? (i + 1) % ONGLETS.length : e.key === 'ArrowLeft' ? (i - 1 + ONGLETS.length) % ONGLETS.length
      : e.key === 'Home' ? 0 : e.key === 'End' ? ONGLETS.length - 1 : -1
    if (cible < 0) return
    e.preventDefault()
    setOnglet(ONGLETS[cible])
    document.getElementById(`onglet-${ONGLETS[cible]}`)?.focus()
  }

  async function nouvelleVersion() {
    setErreur(null); setInfo(null)
    const d = await envoyer(`/api/strategies/${id}/nouvelle-version`, 'POST')
    const nid = (d?.strategie as { id?: string } | undefined)?.id
    if (nid) router.push(`/strategie/${nid}`)
  }

  const champ = 'mt-1 block w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600'
  const lbl = 'block text-xs text-gray-600 dark:text-gray-300'
  const btnIcone = 'btn-secondary text-xs p-1.5 disabled:opacity-40 disabled:cursor-not-allowed'
  const descFige = mode === 'fige' ? 'cadre-fige-info' : undefined
  const ids = lireIdentifiantsExternes(st.identifiantsExternes) ?? []

  const formulaireEdition = (cible: { kind: Edition['kind']; id?: string; axeId?: string }) => {
    const editionId = edition && 'id' in edition ? edition.id : undefined
    if (!edition || edition.kind !== cible.kind || editionId !== cible.id || (edition.kind === 'objectif' && edition.axeId !== cible.axeId)) return null
    return (
      <form onSubmit={enregistrerEdition} className="mt-2 space-y-2 rounded-md border border-gray-200 dark:border-gray-700 p-3">
        {edition.kind === 'axe' && (<>
          <label className={lbl}>{u.titreAxe}<input className={champ} required maxLength={200} value={edition.titre} onChange={e => setEdition({ ...edition, titre: e.target.value })} /></label>
          <label className={lbl}>{u.descriptionAxe}<textarea className={champ} rows={2} maxLength={4000} value={edition.description} onChange={e => setEdition({ ...edition, description: e.target.value })} /></label>
        </>)}
        {edition.kind === 'objectif' && (<>
          <label className={lbl}>{u.titreObjectif}<input className={champ} required maxLength={200} value={edition.titre} onChange={e => setEdition({ ...edition, titre: e.target.value })} /></label>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className={lbl}>{u.indicateur}<input className={champ} maxLength={2000} value={edition.indicateur} onChange={e => setEdition({ ...edition, indicateur: e.target.value })} /></label>
            <label className={lbl}>{u.cible}<input className={champ} maxLength={200} value={edition.cible} onChange={e => setEdition({ ...edition, cible: e.target.value })} /></label>
            <label className={lbl}>{u.echeance}<input type="date" className={champ} value={edition.echeance} onChange={e => setEdition({ ...edition, echeance: e.target.value })} /></label>
            {kris.length > 0 && (
              <label className={lbl}>{u.kri}
                <select className={champ} value={edition.kriId} onChange={e => setEdition({ ...edition, kriId: e.target.value })}>
                  <option value="">{u.aucunKri}</option>
                  {kris.map(k => <option key={k.id} value={k.id}>{k.intitule}</option>)}
                </select>
              </label>
            )}
          </div>
        </>)}
        {edition.kind === 'strategie' && (<>
          {!edition.seulementIds && (<>
            <div className="grid sm:grid-cols-2 gap-2">
              <label className={lbl}>{u.champTitre}<input className={champ} required maxLength={200} value={edition.titre} onChange={e => setEdition({ ...edition, titre: e.target.value })} /></label>
              <label className={lbl}>{u.champType}
                <select className={champ} value={edition.type} onChange={e => setEdition({ ...edition, type: e.target.value as StrategieType })}>
                  {STRATEGIE_TYPES.map(ty => <option key={ty} value={ty}>{s.types[ty]}</option>)}
                </select>
              </label>
              <label className={lbl}>{u.champDebut}<input type="date" className={champ} value={edition.periodeDebut} onChange={e => setEdition({ ...edition, periodeDebut: e.target.value })} /></label>
              <label className={lbl}>{u.champFin}<input type="date" className={champ} value={edition.periodeFin} onChange={e => setEdition({ ...edition, periodeFin: e.target.value })} /></label>
            </div>
            <label className={lbl}>{u.champDescription}<textarea className={champ} rows={2} maxLength={4000} value={edition.description} onChange={e => setEdition({ ...edition, description: e.target.value })} /></label>
          </>)}
          <IdentifiantsEditor value={edition.ids} onChange={v => setEdition({ ...edition, ids: v })} />
        </>)}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary text-xs">{u.enregistrer}</button>
          <button type="button" className="btn-secondary text-xs" onClick={() => setEdition(null)}>{u.annuler}</button>
        </div>
      </form>
    )
  }

  const ouvrirStrategie = (seulementIds: boolean) => setEdition({
    kind: 'strategie', seulementIds, titre: st.titre, type: (STRATEGIE_TYPES as readonly string[]).includes(st.type) ? st.type as StrategieType : 'CYBER',
    periodeDebut: jour(st.periodeDebut), periodeFin: jour(st.periodeFin), description: st.description ?? '',
    ids: { referenceInterne: st.referenceInterne ?? '', identifiantsExternes: ids.map((e: IdentifiantExterne) => ({ ...e })) },
  })

  return (
    <div className="space-y-5">
      <Link href="/strategie" className="text-sm text-ebios-700 dark:text-ebios-300 inline-flex items-center gap-1"><ArrowLeft size={14} aria-hidden="true" />{u.retour}</Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100"><Target size={22} className="inline align-[-0.15em] mr-2 text-ebios-600" aria-hidden="true" />{st.titre}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap gap-x-3 gap-y-1 items-center">
            <span>{typeLib}</span>
            <span>{periodeLisible(st.periodeDebut, st.periodeFin, locale) ?? u.periodeVide}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-sm ${STATUT_STYLE[st.statut] ?? ''}`}>{(s.statuts as Record<string, string>)[st.statut] ?? st.statut}</span>
            <span>{u.versionN.replace('{n}', String(st.version))}</span>
            {st.referenceInterne && <span>{libelleValeur(u.gabaritChamp, u.referenceInterne, st.referenceInterne)}</span>}
            {ids.length > 0 && <span>{ids.map(e => `${e.systeme} ${e.valeur}`).join(', ')}</span>}
          </p>
          {st.description && <p className="text-sm text-gray-700 dark:text-gray-200 mt-2 whitespace-pre-line">{st.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {droits.rediger && st.statut === 'BROUILLON' && <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1" onClick={() => ouvrirStrategie(false)}><Pencil size={14} aria-hidden="true" />{u.modifier}</button>}
          {droits.rediger && st.statut === 'VALIDEE' && <button type="button" className="btn-secondary text-sm" onClick={() => ouvrirStrategie(true)}>{u.modifierIdentifiants}</button>}
          {droits.valider && st.statut === 'BROUILLON' && <button type="button" className="btn-primary text-sm" onClick={() => setConfirm('valider')}>{u.valider}</button>}
          {droits.rediger && st.statut === 'VALIDEE' && <button type="button" className="btn-primary text-sm" onClick={nouvelleVersion}>{u.nouvelleVersion}</button>}
          {droits.valider && st.statut === 'VALIDEE' && <button type="button" className="btn-secondary text-sm" onClick={() => setConfirm('archiver')}>{u.archiver}</button>}
        </div>
      </header>
      {formulaireEdition({ kind: 'strategie' })}

      {st.valideeLe && st.statut !== 'BROUILLON' && (
        <p className="rounded-md bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 px-3 py-2 text-sm text-green-800 dark:text-green-200">
          {u.bandeauValidee.replace('{date}', new Date(st.valideeLe).toLocaleDateString(locale)).replace('{nom}', st.valideeParNom ?? '—')}
        </p>
      )}
      {mode === 'fige' && <p id="cadre-fige-info" className="text-sm text-amber-700 dark:text-amber-300">{u.cadreFigeInfo}</p>}
      {mode === 'justifiee' && <p className="text-sm text-gray-600 dark:text-gray-300">{u.cadreJustifieInfo}</p>}
      {mode === 'lecture' && <p className="text-sm text-gray-600 dark:text-gray-300">{u.archiveeInfo}</p>}
      {erreur && (
        <p role="alert" className="text-sm text-red-600">
          {erreur.msg}{erreur.versionId && <> <Link href={`/strategie/${erreur.versionId}`} className="underline">{u.ouvrirVersion}</Link></>}
        </p>
      )}
      {info && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{info}</p>}

      <div role="tablist" aria-label={st.titre} className="flex gap-1.5 border-b border-gray-200 dark:border-gray-700">
        {ONGLETS.map(o => (
          <button key={o} id={`onglet-${o}`} type="button" role="tab" aria-selected={onglet === o} aria-controls={`panneau-${o}`}
            tabIndex={onglet === o ? 0 : -1} onClick={() => setOnglet(o)} onKeyDown={clavierOnglets}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${onglet === o ? 'border-ebios-600 text-ebios-700 dark:text-ebios-300 font-medium' : 'border-transparent text-gray-500'}`}>{u.onglets[o]}</button>
        ))}
      </div>

      {onglet === 'historique' && (
        <div role="tabpanel" id="panneau-historique" aria-labelledby="onglet-historique">
          <StrategieHistorique id={id} axes={nomsAxes} elements={titresElements} />
        </div>
      )}

      {onglet === 'cadre' && (
        <section role="tabpanel" id="panneau-cadre" aria-labelledby="onglet-cadre" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="axes-titre" className="text-sm font-semibold text-gray-800 dark:text-gray-100">{u.axes}</h2>
            {cadreVisible && (
              <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed" disabled={!cadreActif} aria-describedby={descFige}
                onClick={() => setEdition({ kind: 'axe', titre: '', description: '' })}><Plus size={14} aria-hidden="true" />{u.ajouterAxe}</button>
            )}
          </div>
          {formulaireEdition({ kind: 'axe' })}
          {st.axes.length === 0 && <p className="text-sm text-gray-500">{u.aucunAxe}</p>}

          {st.axes.map((a, idx) => {
            const deja = new Set(a.rattachements.map(r => cle(r.sourceType, r.sourceId)))
            const disponibles = elements.filter(e => !deja.has(cle(e.source, e.sourceId)))
            const selId = `rattacher-${a.id}`
            return (
              <article key={a.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{a.titre}</h3>
                    {a.description && <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">{a.description}</p>}
                  </div>
                  {cadreVisible && (
                    <div className="flex gap-1 shrink-0">
                      <button type="button" className={btnIcone} disabled={!cadreActif || idx === 0} aria-describedby={descFige} aria-label={u.monter.replace('{titre}', a.titre)}
                        onClick={() => deplacer(idx, -1)}><ArrowUp size={14} aria-hidden="true" /></button>
                      <button type="button" className={btnIcone} disabled={!cadreActif || idx === st.axes.length - 1} aria-describedby={descFige} aria-label={u.descendre.replace('{titre}', a.titre)}
                        onClick={() => deplacer(idx, 1)}><ArrowDown size={14} aria-hidden="true" /></button>
                      <button type="button" className={btnIcone} disabled={!cadreActif} aria-describedby={descFige} aria-label={u.modifierElement.replace('{titre}', a.titre)}
                        onClick={() => setEdition({ kind: 'axe', id: a.id, titre: a.titre, description: a.description ?? '' })}><Pencil size={14} aria-hidden="true" /></button>
                      <button type="button" className={btnIcone} disabled={!cadreActif} aria-describedby={descFige} aria-label={u.supprimerElement.replace('{titre}', a.titre)}
                        onClick={() => executer(besoinCadre, j => envoyer(`/api/strategies/${id}/axes/${a.id}`, 'DELETE', j.justification ? j : undefined), u.confirmerSupprAxe.replace('{titre}', a.titre))}><Trash2 size={14} aria-hidden="true" /></button>
                    </div>
                  )}
                </div>
                {formulaireEdition({ kind: 'axe', id: a.id })}
                <IdentifiantsCompacts key={`ids-${a.id}-${String(a.referenceInterne)}-${JSON.stringify(a.identifiantsExternes ?? null)}`}
                  referenceInterne={a.referenceInterne ?? null} identifiantsExternes={lireIdentifiantsExternes(a.identifiantsExternes)}
                  onSave={peutIds ? v => enregistrerIds(`/api/strategies/${id}/axes/${a.id}`, v) : undefined} />

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{u.objectifs}</h4>
                    {cadreVisible && (
                      <button type="button" className="btn-secondary text-xs inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed" disabled={!cadreActif} aria-describedby={descFige}
                        onClick={() => setEdition({ kind: 'objectif', axeId: a.id, titre: '', indicateur: '', cible: '', echeance: '', kriId: '' })}><Plus size={13} aria-hidden="true" />{u.ajouterObjectif}</button>
                    )}
                  </div>
                  {formulaireEdition({ kind: 'objectif', axeId: a.id })}
                  {a.objectifs.length === 0 ? <p className="text-sm text-gray-500">{u.aucunObjectif}</p> : (
                    <ul className="mt-1 space-y-1.5">
                      {a.objectifs.map(o => {
                        const kri = o.kriId ? kris.find(k => k.id === o.kriId)?.intitule ?? o.kriId : null
                        const details = [
                          o.indicateur && libelleValeur(u.gabaritChamp, u.indicateur, o.indicateur),
                          o.cible && libelleValeur(u.gabaritChamp, u.cible, o.cible),
                          o.echeance && libelleValeur(u.gabaritChamp, u.echeance, new Date(o.echeance).toLocaleDateString(locale, { timeZone: 'UTC' })),
                          kri && libelleValeur(u.gabaritChamp, u.champs.kriId, kri),
                        ].filter(Boolean).join(' · ')
                        return (
                          <li key={o.id} className="text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-gray-800 dark:text-gray-100">{o.titre}</p>
                                {details && <p className="text-xs text-gray-500 dark:text-gray-400">{details}</p>}
                              </div>
                              {cadreVisible && (
                                <div className="flex gap-1 shrink-0">
                                  <button type="button" className={btnIcone} disabled={!cadreActif} aria-describedby={descFige} aria-label={u.modifierElement.replace('{titre}', o.titre)}
                                    onClick={() => setEdition({ kind: 'objectif', axeId: a.id, id: o.id, titre: o.titre, indicateur: o.indicateur ?? '', cible: o.cible ?? '', echeance: jour(o.echeance), kriId: o.kriId ?? '' })}><Pencil size={13} aria-hidden="true" /></button>
                                  <button type="button" className={btnIcone} disabled={!cadreActif} aria-describedby={descFige} aria-label={u.supprimerElement.replace('{titre}', o.titre)}
                                    onClick={() => executer(besoinCadre, j => envoyer(`/api/strategies/${id}/objectifs/${o.id}`, 'DELETE', j.justification ? j : undefined), u.confirmerSupprObjectif.replace('{titre}', o.titre))}><Trash2 size={13} aria-hidden="true" /></button>
                                </div>
                              )}
                            </div>
                            {formulaireEdition({ kind: 'objectif', axeId: a.id, id: o.id })}
                            <IdentifiantsCompacts key={`ids-${o.id}-${String(o.referenceInterne)}-${JSON.stringify(o.identifiantsExternes ?? null)}`}
                              referenceInterne={o.referenceInterne ?? null} identifiantsExternes={lireIdentifiantsExternes(o.identifiantsExternes)}
                              onSave={peutIds ? v => enregistrerIds(`/api/strategies/${id}/objectifs/${o.id}`, v) : undefined} />
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{u.rattachements}</h4>
                  {a.rattachements.length === 0 ? <p className="text-sm text-gray-500">{u.aucunRattachement}</p> : (
                    <ul className="mt-1 space-y-1">
                      {a.rattachements.map(r => {
                        const el = parCle.get(cle(r.sourceType, r.sourceId))
                        const titre = el?.titre ?? u.elementInconnu.replace('{id}', r.sourceId)
                        return (
                          <li key={r.id} className="text-sm flex items-center justify-between gap-2">
                            <span>
                              <span className="text-xs text-gray-500 mr-1.5">{(u.sources as Record<string, string>)[r.sourceType] ?? r.sourceType}</span>
                              {el?.lien ? <Link href={el.lien} className="text-ebios-700 dark:text-ebios-300 hover:underline">{titre}</Link> : <span>{titre}</span>}
                              <span className="text-xs text-gray-400 ml-1.5">{libelleValeur(u.gabaritChamp, u.provenance, (s.provenances as Record<string, string>)[r.provenance] ?? r.provenance)}</span>
                            </span>
                            {peutRattacher && (
                              <button type="button" className={btnIcone} aria-label={u.retirer.replace('{titre}', titre)}
                                onClick={() => executer(besoinRattachement, j => envoyer(`/api/strategies/${id}/rattachements/${r.id}`, 'DELETE', j.justification ? j : undefined))}><X size={13} aria-hidden="true" /></button>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {peutRattacher && (disponibles.length === 0 ? <p className="text-xs text-gray-400 mt-1">{u.aucuneAction}</p> : (
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[14rem]">
                        <label htmlFor={selId} className={lbl}>{u.choisirAction}</label>
                        <select id={selId} className={champ} value={selection[a.id] ?? ''} onChange={e => setSelection(p => ({ ...p, [a.id]: e.target.value }))}>
                          <option value="">—</option>
                          {disponibles.map(e => (
                            <option key={cle(e.source, e.sourceId)} value={cle(e.source, e.sourceId)}>{`${(u.sources as Record<string, string>)[e.source] ?? e.source} — ${e.titre}`}</option>
                          ))}
                        </select>
                      </div>
                      <button type="button" className="btn-secondary text-sm" disabled={!selection[a.id]} onClick={() => rattacher(a.id)}>{u.rattacher}</button>
                    </div>
                  ))}
                </div>
              </article>
            )
          })}
        </section>
      )}

      {dialog && <JustificationDialog onConfirm={dialog.run} onCancel={() => setDialog(null)} />}
      {suppression && (
        <ConfirmDialog message={suppression.message} onConfirm={suppression.run} onCancel={() => setSuppression(null)} />
      )}
      {confirm && (
        <ConfirmDialog variant="primary" icon={<Target size={24} aria-hidden="true" />}
          title={confirm === 'valider' ? u.valider : u.archiver} confirmLabel={confirm === 'valider' ? u.valider : u.archiver}
          message={confirm === 'valider' ? u.confirmerValider : u.confirmerArchiver}
          onConfirm={() => transition(confirm)} onCancel={() => setConfirm(null)} />
      )}
    </div>
  )
}
