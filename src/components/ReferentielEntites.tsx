'use client'

// ─── Référentiel des entités (consolidation, lot E1) ──────────────────────────
// Liste hiérarchique des entités de l'organisation active (filiales, directions, sites, services) avec alias,
// identifiant externe, organisation ACRA liée et clôture. Écriture ADMIN ; champs verrouillés quand l'annuaire fait foi.
// API : /api/referentiel-entites. Spec : docs/specs/entites-consolidation-besoin.md.
import { useEffect, useState } from 'react'
import { Network, Pencil, Plus, Trash2, Archive, ArchiveRestore, Upload, Link2, GitMerge } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import ImportEntitesPanel from './ImportEntitesPanel'
import RapprochementEntitesPanel from './RapprochementEntitesPanel'
import ReorganisationEntitePanel from './ReorganisationEntitePanel'
import HistoriqueEntites from './HistoriqueEntites'
import { TYPES_ENTITE, champsVerrouilles, construireArbre, estActive, type EntiteRef, type NoeudEntite, type SourceVerite, type TypeEntite } from '@/lib/entites'

type Compte = Record<'risques' | 'incidents' | 'conformites' | 'plansAction' | 'traitementsConformite' | 'mesures' | 'enfants', number>
interface EntiteApi extends Omit<EntiteRef, 'valideAu'> { organisationLieeId: string | null; valideDu: string | null; valideAu: string | null; _count: Compte }
interface Donnees { entites: EntiteApi[]; organisations: { id: string; nom: string }[]; peutModifier: boolean; sourceVerite: SourceVerite; connecteur?: boolean }
type Ligne = EntiteRef & { api: EntiteApi }
interface Formulaire { id?: string; nom: string; type: TypeEntite; codeExterne: string; alias: string; parentId: string; organisationLieeId: string; valideDu: string; valideAu: string; source: string }

const VIDE: Formulaire = { nom: '', type: 'DIRECTION', codeExterne: '', alias: '', parentId: '', organisationLieeId: '', valideDu: '', valideAu: '', source: 'MANUEL' }
const jour = (d: string | null) => (d ? d.slice(0, 10) : '')
const references = (c: Compte) => c.risques + c.incidents + c.conformites + c.plansAction + c.traitementsConformite + c.mesures

export default function ReferentielEntites() {
  const { t, locale } = useTranslation()
  const r = t.entites.referentiel
  const [data, setData] = useState<Donnees | null>(null)
  const [closes, setCloses] = useState(false)
  const [form, setForm] = useState<Formulaire | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [doublons, setDoublons] = useState<{ id: string; nom: string }[]>([])
  const [importer, setImporter] = useState(false)
  const [rapprocher, setRapprocher] = useState(false)
  const [reorg, setReorg] = useState<{ id: string; nom: string } | null>(null)
  // Incrémenté après une réorganisation : recharge l'historique.
  const [version, setVersion] = useState(0)

  const recharger = () => fetch('/api/referentiel-entites').then(x => (x.ok ? x.json() : null)).then(setData).catch(() => {})
  useEffect(() => { recharger() }, [])

  function messageErreur(code?: string) { return (r.erreurs as Record<string, string>)[code ?? ''] ?? r.erreurs.defaut }

  async function envoyer(url: string, method: string, body?: unknown): Promise<boolean> {
    setErreur(null)
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => null)
    if (res?.ok) { recharger(); return true }
    const j = res ? ((await res.json().catch(() => ({}))) as { error?: string; correspondances?: { id: string; nom: string }[] }) : {}
    if (j.error === 'doublon') { setDoublons(j.correspondances ?? []); return false }
    setErreur(messageErreur(j.error))
    return false
  }

  async function enregistrer(confirmer = false) {
    if (!form) return
    const verrou = form.id ? champsVerrouilles({ source: form.source }, data!.sourceVerite) : []
    const corps: Record<string, unknown> = {
      nom: form.nom, type: form.type, codeExterne: form.codeExterne, parentId: form.parentId || null,
      alias: form.alias.split(',').map(a => a.trim()).filter(Boolean),
      organisationLieeId: form.type === 'FILIALE' ? form.organisationLieeId || null : null,
      valideDu: form.valideDu || null, valideAu: form.valideAu || null,
    }
    for (const k of verrou) delete corps[k]
    const ok = form.id ? await envoyer(`/api/referentiel-entites/${form.id}`, 'PATCH', corps) : await envoyer('/api/referentiel-entites', 'POST', confirmer ? { ...corps, confirmer: true } : corps)
    if (ok) { setForm(null); setDoublons([]) }
  }

  function editer(e: EntiteApi) {
    setErreur(null); setDoublons([])
    setForm({ id: e.id, nom: e.nom, type: e.type as TypeEntite, codeExterne: e.codeExterne ?? '', alias: e.alias.join(', '), parentId: e.parentId ?? '', organisationLieeId: e.organisationLieeId ?? '', valideDu: jour(e.valideDu), valideAu: jour(e.valideAu), source: e.source })
  }

  if (!data) return <p className="text-sm text-gray-400">…</p>
  const lignes: Ligne[] = data.entites.map(e => ({ ...e, valideAu: e.valideAu ? new Date(e.valideAu) : null, api: e }))
  const visibles = closes ? lignes : lignes.filter(e => estActive(e))
  const arbre = construireArbre(visibles)
  const orgNom = new Map(data.organisations.map(o => [o.id, o.nom]))
  const verrou = form?.id ? champsVerrouilles({ source: form.source }, data.sourceVerite) : []
  const champ = 'mt-1 block w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-500 dark:bg-gray-800 dark:border-gray-600'
  const fmt = (d: Date) => d.toLocaleDateString(locale)
  // Descendants exclus du choix du parent (pas de boucle).
  const descendants = new Set<string>()
  if (form?.id) {
    const pile = [form.id]
    while (pile.length) { const id = pile.pop()!; descendants.add(id); lignes.filter(e => e.parentId === id).forEach(e => pile.push(e.id)) }
  }

  const rendreNoeud = (n: NoeudEntite<Ligne>, niveau: number) => {
    const e = n.entite.api
    const active = estActive(n.entite)
    const nb = references(e._count)
    const details = [e.codeExterne, e.alias.length ? e.alias.join(', ') : null, e.organisationLieeId && orgNom.get(e.organisationLieeId) ? r.liee.replace('{o}', orgNom.get(e.organisationLieeId)!) : null, nb ? r.references.replace('{n}', String(nb)) : null].filter(Boolean)
    return (
      <li key={e.id}>
        <div className={`flex flex-wrap items-center gap-2 py-1.5 border-b border-gray-100 dark:border-gray-700 ${active ? '' : 'opacity-60'}`} style={{ paddingLeft: `${niveau * 1.25}rem` }}>
          <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{e.nom}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-ebios-50 text-ebios-800 dark:bg-ebios-500/15 dark:text-ebios-200">{r.types[e.type as TypeEntite] ?? e.type}</span>
          {e.source !== 'MANUEL' && <span className="text-[11px] text-gray-500">{r.sources[e.source as keyof typeof r.sources] ?? e.source}</span>}
          {!active && n.entite.valideAu && <span className="text-[11px] text-amber-700 dark:text-amber-300">{r.close.replace('{d}', fmt(n.entite.valideAu))}</span>}
          {details.length > 0 && <span className="text-xs text-gray-500 dark:text-gray-400">{details.join(' · ')}</span>}
          {data.peutModifier && (
            <span className="ml-auto flex gap-1">
              <button type="button" onClick={() => editer(e)} aria-label={`${r.modifier} ${e.nom}`} title={r.modifier} className="p-1 text-gray-500 hover:text-ebios-700"><Pencil size={14} aria-hidden="true" /></button>
              {active && <button type="button" onClick={() => { setForm(null); setReorg({ id: e.id, nom: e.nom }) }} aria-label={`${r.reorganisation.ouvrir} ${e.nom}`} title={r.reorganisation.ouvrir} className="p-1 text-gray-500 hover:text-ebios-700"><GitMerge size={14} aria-hidden="true" /></button>}
              {active
                ? <button type="button" onClick={() => envoyer(`/api/referentiel-entites/${e.id}`, 'PATCH', { valideAu: new Date().toISOString().slice(0, 10) })} aria-label={`${r.clore} ${e.nom}`} title={r.clore} className="p-1 text-gray-500 hover:text-amber-700"><Archive size={14} aria-hidden="true" /></button>
                : <button type="button" onClick={() => envoyer(`/api/referentiel-entites/${e.id}`, 'PATCH', { valideAu: null })} aria-label={`${r.rouvrir} ${e.nom}`} title={r.rouvrir} className="p-1 text-gray-500 hover:text-ebios-700"><ArchiveRestore size={14} aria-hidden="true" /></button>}
              {nb === 0 && e._count.enfants === 0 && (
                <button type="button" onClick={() => { if (window.confirm(r.confirmerSuppression.replace('{n}', e.nom))) envoyer(`/api/referentiel-entites/${e.id}`, 'DELETE') }} aria-label={`${r.supprimer} ${e.nom}`} title={r.supprimer} className="p-1 text-gray-500 hover:text-red-700"><Trash2 size={14} aria-hidden="true" /></button>
              )}
            </span>
          )}
        </div>
        {n.enfants.length > 0 && <ul>{n.enfants.map(c => rendreNoeud(c, niveau + 1))}</ul>}
      </li>
    )
  }

  return (
    <section className="card p-4 space-y-3" aria-labelledby="referentiel-entites-titre">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="referentiel-entites-titre" className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex gap-2 items-center"><Network size={16} aria-hidden="true" />{r.titre}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{r.desc}</p>
        </div>
        {data.peutModifier && !form && (
          <span className="flex gap-2">
            {!rapprocher && <button type="button" onClick={() => setRapprocher(true)} className="btn-secondary text-sm inline-flex items-center gap-1.5"><Link2 size={15} aria-hidden="true" />{r.rapprochement.ouvrir}</button>}
            {!importer && <button type="button" onClick={() => setImporter(true)} className="btn-secondary text-sm inline-flex items-center gap-1.5"><Upload size={15} aria-hidden="true" />{r.import.importer}</button>}
            <button type="button" onClick={() => { setErreur(null); setDoublons([]); setForm({ ...VIDE }) }} className="btn-primary text-sm inline-flex items-center gap-1.5"><Plus size={15} aria-hidden="true" />{r.ajouter}</button>
          </span>
        )}
      </header>
      {!data.peutModifier && <p className="text-xs text-gray-500">{r.lectureSeule}</p>}
      {data.sourceVerite === 'ANNUAIRE' && <p className="text-xs rounded-sm bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200 px-2 py-1.5">{r.annuaireFaitFoi}</p>}

      {rapprocher && data.peutModifier && (
        <RapprochementEntitesPanel entites={data.entites.filter(e => !e.valideAu || new Date(e.valideAu) > new Date()).map(e => ({ id: e.id, nom: e.nom }))} onTermine={recharger} onFermer={() => setRapprocher(false)} />
      )}
      {importer && data.peutModifier && (
        <ImportEntitesPanel connecteur={!!data.connecteur} existantes={data.entites.map(e => ({ id: e.id, nom: e.nom }))} onTermine={recharger} onFermer={() => setImporter(false)} />
      )}
      {form && (
        <div className="rounded-sm border border-gray-200 dark:border-gray-700 p-3 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-gray-600 dark:text-gray-300">{r.nom}
              <input aria-label={r.nom} value={form.nom} disabled={verrou.includes('nom')} title={verrou.includes('nom') ? r.verrouille : undefined} onChange={ev => setForm({ ...form, nom: ev.target.value })} className={champ} />
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{r.type}
              <select aria-label={r.type} value={form.type} onChange={ev => setForm({ ...form, type: ev.target.value as TypeEntite })} className={champ}>
                {TYPES_ENTITE.map(ty => <option key={ty} value={ty}>{r.types[ty]}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{r.code}
              <input aria-label={r.code} value={form.codeExterne} placeholder={r.codePh} disabled={verrou.includes('codeExterne')} title={verrou.includes('codeExterne') ? r.verrouille : undefined} onChange={ev => setForm({ ...form, codeExterne: ev.target.value })} className={champ} />
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{r.alias}
              <input aria-label={r.alias} value={form.alias} placeholder={r.aliasPh} onChange={ev => setForm({ ...form, alias: ev.target.value })} className={champ} />
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{r.parent}
              <select aria-label={r.parent} value={form.parentId} disabled={verrou.includes('parentId')} title={verrou.includes('parentId') ? r.verrouille : undefined} onChange={ev => setForm({ ...form, parentId: ev.target.value })} className={champ}>
                <option value="">{r.aucunParent}</option>
                {lignes.filter(e => !descendants.has(e.id)).sort((a, b) => a.nom.localeCompare(b.nom)).map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
            </label>
            {form.type === 'FILIALE' && (
              <label className="text-xs text-gray-600 dark:text-gray-300">{r.organisationLiee}
                <select aria-label={r.organisationLiee} value={form.organisationLieeId} onChange={ev => setForm({ ...form, organisationLieeId: ev.target.value })} className={champ}>
                  <option value="">{r.aucuneOrganisation}</option>
                  {data.organisations.map(o => <option key={o.id} value={o.id}>{o.nom}</option>)}
                </select>
              </label>
            )}
            <label className="text-xs text-gray-600 dark:text-gray-300">{r.valideDu}
              <input aria-label={r.valideDu} type="date" value={form.valideDu} onChange={ev => setForm({ ...form, valideDu: ev.target.value })} className={champ} />
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{r.valideAu}
              <input aria-label={r.valideAu} type="date" value={form.valideAu} onChange={ev => setForm({ ...form, valideAu: ev.target.value })} className={champ} />
            </label>
          </div>
          {doublons.length > 0 && (
            <div role="alert" className="text-sm rounded-sm bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200 px-2 py-1.5">
              <p>{r.doublon}</p>
              <ul className="list-disc ml-5">{doublons.map(d => <li key={d.id}>{d.nom}</li>)}</ul>
              <button type="button" onClick={() => enregistrer(true)} className="btn-secondary text-xs mt-1">{r.creerQuandMeme}</button>
            </div>
          )}
          {erreur && <p role="alert" className="text-sm text-red-600">{erreur}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => enregistrer()} className="btn-primary text-sm">{r.enregistrer}</button>
            <button type="button" onClick={() => { setForm(null); setDoublons([]); setErreur(null) }} className="btn-secondary text-sm">{r.annuler}</button>
          </div>
        </div>
      )}
      {!form && erreur && <p role="alert" className="text-sm text-red-600">{erreur}</p>}

      {reorg && data.peutModifier && (
        <ReorganisationEntitePanel key={reorg.id} entite={reorg} entites={lignes.filter(e => estActive(e)).map(e => ({ id: e.id, nom: e.nom }))}
          onTermine={() => { setReorg(null); setVersion(v => v + 1); recharger() }} onAnnuler={() => setReorg(null)} />
      )}
      <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
        <input type="checkbox" checked={closes} onChange={ev => setCloses(ev.target.checked)} aria-label={r.afficherCloses} />{r.afficherCloses}
      </label>
      {arbre.length === 0 ? <p className="text-sm italic text-gray-400">{r.vide}</p> : <ul>{arbre.map(n => rendreNoeud(n, 0))}</ul>}
      <HistoriqueEntites key={version} />
    </section>
  )
}
