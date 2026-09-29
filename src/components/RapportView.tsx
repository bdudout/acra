'use client'

// ─── Édition d'un rapport : contenu figé + cycle de validation ───────────────
// Rend les sections (indicateurs, tableaux) dans la langue du lecteur ; les actions
// (relire, valider, diffuser, régénérer, supprimer) dépendent du statut et des droits.
// Imprimable en PDF depuis le navigateur ; export Excel côté serveur.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { STATUT_BADGE } from '@/components/RapportsManager'
import { resoudreCellule, titreSection, libelleKpi, libelleColonne, formaterKpi } from '@/lib/rapport-render'
import type { RapportContenu } from '@/lib/rapport-model'
import { appliquerGabarit, masquerContenu, type GabaritRapport } from '@/lib/rapport-masquage'

interface Edition {
  id: string; code: string; statut: string; periodeDebut: string; periodeFin: string; createdById: string; canWrite: boolean
  destinataires?: { nom: string; statut?: string; envoye?: boolean }[]; contenu: RapportContenu; diffuseLe?: string | null
}

export default function RapportView({ id }: { id: string }) {
  const { t, locale } = useTranslation()
  const r = t.rapports
  const router = useRouter()
  const [e, setE] = useState<Edition | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dest, setDest] = useState('')
  const [masque, setMasque] = useState(false)
  const [gabarits, setGabarits] = useState<Record<string, GabaritRapport>>({})
  const tr = useCallback((key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], t) as string | undefined, [t])
  const catalogue = { ...r.catalogue, ...r.catalogueCtl, ...r.catalogueAud } as Record<string, { titre: string; desc: string }>

  const load = useCallback(() => { fetch(`/api/rapports/${id}`).then(x => (x.ok ? x.json() : null)).then(d => setE(d)).catch(() => setE(null)) }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => { fetch('/api/rapports/config').then(x => (x.ok ? x.json() : null)).then(d => setGabarits(d?.config?.gabarits ?? {})).catch(() => {}) }, [])

  async function agir(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setError(null)
    const res = await fetch(`/api/rapports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    setBusy(false)
    if (!res || !res.ok) { setError((r.errors as Record<string, string>)[d?.error] ?? String(d?.error ?? res?.status ?? '—')); return }
    load()
  }
  async function supprimer() {
    if (!confirm(`${r.actions.supprimer} ?`)) return
    const res = await fetch(`/api/rapports/${id}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) router.push('/rapports')
  }

  if (!e) return <p className="text-sm text-gray-400">…</p>
  const gabarit = gabarits[e.code]
  const base = appliquerGabarit(e.contenu, gabarit)
  const c = masque ? masquerContenu(base) : base
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { timeZone: 'UTC' })
  const figee = e.statut !== 'BROUILLON'
  const btn = 'btn-secondary text-xs disabled:opacity-50'

  return (
    <article className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/rapports" className="text-xs text-ebios-700 hover:underline inline-flex items-center gap-1"><ArrowLeft size={13} aria-hidden="true" />{r.actions.retour}</Link>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-600 dark:text-gray-300 inline-flex items-center gap-1" title={r.masquerHint}><input type="checkbox" checked={masque} onChange={ev => setMasque(ev.target.checked)} />{r.masquer}</label>
          <a href={`/api/rapports/${id}/export?lang=${locale}${masque ? '&masque=1' : ''}`} className={btn}>{r.actions.excel}</a>
          <a href={`/api/rapports/${id}/export?format=pdf&lang=${locale}${masque ? '&masque=1' : ''}`} className={btn}>{r.actions.pdf}</a>
          <button type="button" onClick={() => window.print()} className={`${btn} inline-flex items-center gap-1`}><Printer size={13} aria-hidden="true" />{r.actions.imprimer}</button>
        </div>
      </div>

      <header>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{gabarit?.titre ?? catalogue[e.code]?.titre ?? e.code}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {day(e.periodeDebut)} → {day(e.periodeFin)} · <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUT_BADGE[e.statut] ?? STATUT_BADGE.BROUILLON}`}>{(r.statuts as Record<string, string>)[e.statut] ?? e.statut}</span>
          {figee && <span className="ml-2 text-xs italic">{r.figee}</span>}
        </p>
        {e.diffuseLe && e.destinataires && e.destinataires.length > 0 && <p className="text-xs text-gray-500 mt-1">{e.destinataires.map(d => `${d.nom}${d.statut === 'HORS_ORGANISATION' ? ` (${r.destExterne})` : d.statut === 'A_ENVOYER' ? ` (${d.envoye ? r.destEnvoye : r.destNonEnvoye})` : ''}`).join(', ')}</p>}
      </header>

      {gabarit?.introduction && <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">{gabarit.introduction}</p>}

      {e.canWrite && (
        <div className="print:hidden space-y-2">
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {e.statut === 'BROUILLON' && <>
              <button type="button" disabled={busy} onClick={() => agir('RELU')} className={btn}>{r.actions.relire}</button>
              <button type="button" disabled={busy} onClick={() => agir('REGENERER')} className={btn}>{r.actions.regenerer}</button>
              <button type="button" disabled={busy} onClick={supprimer} className="text-xs text-red-600 hover:underline">{r.actions.supprimer}</button>
            </>}
            {e.statut === 'RELU' && <>
              <button type="button" disabled={busy} onClick={() => agir('VALIDE')} className="btn-primary text-xs disabled:opacity-50">{r.actions.valider}</button>
              <button type="button" disabled={busy} onClick={() => agir('BROUILLON')} className={btn}>{r.actions.renvoyer}</button>
            </>}
            {e.statut === 'VALIDE' && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-gray-500">{r.destinataires}
                  <input aria-label={r.destinataires} value={dest} onChange={ev => setDest(ev.target.value)} className="block mt-1 px-2 py-1.5 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm w-80" />
                </label>
                <button type="button" disabled={busy} onClick={() => agir('DIFFUSE', { destinataires: dest.split(',').map(x => x.trim()).filter(Boolean) })} className="btn-primary text-xs disabled:opacity-50">{r.actions.diffuser}</button>
              </div>
            )}
          </div>
          {e.statut === 'VALIDE' && <p className="text-[11px] text-gray-400">{r.diffuseHint} {r.diffuseEmailHint}</p>}
        </div>
      )}

      {c.sections.map(s => (
        <section key={s.id} className="card p-4 break-inside-avoid" aria-label={titreSection(s.id, tr)}>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">{titreSection(s.id, tr)}</h2>
          {s.blocs.map((b, i) => b.type === 'kpis' ? (
            <dl key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {b.items.map(k => (
                <div key={k.cle}><dt className="text-xs text-gray-500">{libelleKpi(k.cle, tr)}</dt>
                  <dd className={`text-xl font-bold tabular-nums ${k.alerte ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>{formaterKpi(k, c.deviseReference, locale, tr)}</dd></div>
              ))}
            </dl>
          ) : b.type === 'tableau' ? (
            <div key={i} className="overflow-x-auto">
              {b.lignes.length === 0 ? <p className="text-xs italic text-gray-400">—</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
                    {b.colonnes.map(col => <th key={col} className="py-1.5 pr-3">{libelleColonne(col, tr)}</th>)}
                  </tr></thead>
                  <tbody>
                    {b.lignes.map((l, k) => (
                      <tr key={k} className="border-b border-gray-100 dark:border-gray-800">
                        {l.map((cell, j) => <td key={j} className="py-1.5 pr-3 tabular-nums">{resoudreCellule(cell, tr)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : <p key={i} className="text-xs text-amber-700 dark:text-amber-300">{tr(b.cle) ?? b.cle}</p>)}
        </section>
      ))}
      <p className="text-[11px] text-gray-400">{new Date(c.genereLe).toLocaleString(locale)}</p>
    </article>
  )
}
