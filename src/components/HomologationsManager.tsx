'use client'

// ─── Registre des homologations de sécurité ───────────────────────────────────
//
// Registre (statut, validité), ouverture d'un dossier, fiche (pièces, autorité, durée) et décision.
// Gardes UI = gardes pures de lib/homologation (mêmes règles que l'API) : le préparateur ne voit jamais
// les boutons de décision. Spec : docs/specs/protection-sociale-specs.md (P2). Cf. page /homologations.

import { useState } from 'react'
import Link from 'next/link'
import { BadgeCheck, Plus, X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { formatDate } from '@/lib/format'
import type { UserRole } from '@/lib/permissions'
import {
  canDeciderHomologation, canPreparerHomologation, dossierComplet, DUREE_DEFAUT_MOIS,
  type EtatValidite, type HomologationStatut, type PieceEtat, type Reserve,
} from '@/lib/homologation'

export interface HomologationRow {
  id: string; systeme: string; perimetre: string | null; statut: string; etat: EtatValidite
  analyseId: string | null; analyseNom: string | null; preparePar: string; autoriteId: string | null
  dureeMois: number; pieces: PieceEtat[]; reserves: Reserve[]
  dateDecision: string | null; dateFin: string | null; commentaireDecision: string | null
}

interface Props {
  initial: HomologationRow[]
  analyses: { id: string; nom: string }[]
  membres: { id: string; nom: string }[]
  userId: string
  role: UserRole
}

const ETAT_BADGE: Record<EtatValidite, string> = {
  NON_DECIDEE: 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300',
  VALIDE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  A_RENOUVELER: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  EXPIREE: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  REFUSEE: 'bg-gray-200 text-gray-700 dark:bg-gray-600/40 dark:text-gray-300',
}
const INPUT = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm'
const BTN = 'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50'

export default function HomologationsManager({ initial, analyses, membres, userId, role }: Props) {
  const { t, locale } = useTranslation()
  const th = t.homologation
  const [items, setItems] = useState<HomologationRow[]>(initial)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ systeme: '', perimetre: '', analyseId: '', dureeMois: DUREE_DEFAUT_MOIS })
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const canPrepare = canPreparerHomologation(role)

  const errorText = (code: unknown) => (typeof code === 'string' && code in th.errors ? th.errors[code as keyof typeof th.errors] : th.errors.failed)

  async function reload() {
    const res = await fetch('/api/homologations')
    if (res.ok) {
      const data = await res.json() as { items?: HomologationRow[] }
      if (Array.isArray(data.items)) setItems(data.items)
    }
  }

  async function send(url: string, method: 'POST' | 'PATCH', body: unknown): Promise<boolean> {
    setBusy(true); setError(null)
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { setError(errorText((await res.json().catch(() => ({}))).error)); return false }
      await reload()
      return true
    } catch { setError(th.errors.failed); return false } finally { setBusy(false) }
  }

  async function create() {
    if (!form.systeme.trim()) return
    const ok = await send('/api/homologations', 'POST', { systeme: form.systeme, perimetre: form.perimetre || undefined, analyseId: form.analyseId || undefined, dureeMois: form.dureeMois })
    if (ok) { setCreating(false); setForm({ systeme: '', perimetre: '', analyseId: '', dureeMois: DUREE_DEFAUT_MOIS }) }
  }

  const open = items.find(i => i.id === openId) ?? null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white"><BadgeCheck className="h-6 w-6" aria-hidden />{th.title}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{th.subtitle}</p>
        </div>
        {canPrepare && !creating && (
          <button type="button" className={`${BTN} bg-blue-600 text-white hover:bg-blue-700`} onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />{th.new}</button>
        )}
      </div>
      {!canPrepare && <p className="text-sm text-gray-500 dark:text-gray-400">{th.readOnly}</p>}
      {error && <p role="alert" className="rounded-md bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}

      {creating && (
        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">{th.systeme}<input aria-label={th.systeme} className={INPUT} value={form.systeme} maxLength={200} onChange={e => setForm({ ...form, systeme: e.target.value })} /></label>
            <label className="text-sm">{th.analyse}
              <select aria-label={th.analyse} className={INPUT} value={form.analyseId} onChange={e => setForm({ ...form, analyseId: e.target.value })}>
                <option value="">{th.aucuneAnalyse}</option>
                {analyses.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">{th.perimetre}<textarea aria-label={th.perimetre} className={INPUT} rows={2} value={form.perimetre} onChange={e => setForm({ ...form, perimetre: e.target.value })} /></label>
            <label className="text-sm">{th.duree}<input aria-label={th.duree} type="number" min={1} max={60} className={INPUT} value={form.dureeMois} onChange={e => setForm({ ...form, dureeMois: Number(e.target.value) })} /></label>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy || !form.systeme.trim()} className={`${BTN} bg-blue-600 text-white hover:bg-blue-700`} onClick={create}>{th.create}</button>
            <button type="button" className={`${BTN} border border-gray-300 dark:border-gray-600`} onClick={() => setCreating(false)}>{th.close}</button>
          </div>
        </section>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{th.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40 text-left text-gray-600 dark:text-gray-400">
              <tr><th className="px-3 py-2">{th.colSysteme}</th><th className="px-3 py-2">{th.colAnalyse}</th><th className="px-3 py-2">{th.colStatut}</th><th className="px-3 py-2">{th.colEtat}</th><th className="px-3 py-2">{th.colFin}</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map(h => (
                <tr key={h.id}>
                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{h.systeme}</td>
                  <td className="px-3 py-2">{h.analyseId ? <Link className="text-blue-600 hover:underline" href={`/analyses/${h.analyseId}`}>{h.analyseNom ?? '—'}</Link> : '—'}</td>
                  <td className="px-3 py-2">{th.statut[h.statut as HomologationStatut] ?? h.statut}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ETAT_BADGE[h.etat]}`}>{th.etat[h.etat]}</span></td>
                  <td className="px-3 py-2">{h.dateFin ? formatDate(h.dateFin, locale) : '—'}</td>
                  <td className="px-3 py-2 text-right"><button type="button" className="text-blue-600 hover:underline" onClick={() => { setOpenId(h.id); setError(null) }}>{th.open}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Fiche key={open.id} h={open} membres={membres} userId={userId} role={role} busy={busy}
          onClose={() => setOpenId(null)}
          onUpdate={body => send(`/api/homologations/${open.id}`, 'PATCH', { action: 'update', ...body })}
          onTransition={body => send(`/api/homologations/${open.id}`, 'PATCH', { action: 'transition', ...body })} />
      )}
    </div>
  )
}

function Fiche({ h, membres, userId, role, busy, onClose, onUpdate, onTransition }: {
  h: HomologationRow; membres: { id: string; nom: string }[]; userId: string; role: UserRole; busy: boolean
  onClose: () => void; onUpdate: (b: Record<string, unknown>) => Promise<boolean>; onTransition: (b: Record<string, unknown>) => Promise<boolean>
}) {
  const { t, locale } = useTranslation()
  const th = t.homologation
  const [pieces, setPieces] = useState<PieceEtat[]>(h.pieces)
  const [autoriteId, setAutoriteId] = useState(h.autoriteId ?? '')
  const [dureeMois, setDureeMois] = useState(h.dureeMois)
  const [commentaire, setCommentaire] = useState('')
  const [reserves, setReserves] = useState<Reserve[]>([])
  const [saved, setSaved] = useState(false)

  const statut = h.statut as HomologationStatut
  const enInstruction = statut === 'PREPARATION' || statut === 'COMMISSION'
  const canPrepare = canPreparerHomologation(role)
  const editable = canPrepare && enInstruction
  const user = { id: userId, role }
  const decideur = statut === 'COMMISSION' && canDeciderHomologation(user, h)
  const complet = dossierComplet(pieces)

  const setPiece = (i: number, patch: Partial<PieceEtat>) => setPieces(ps => ps.map((p, k) => (k === i ? { ...p, ...patch } : p)))
  const decide = (to: HomologationStatut) => onTransition({ to, commentaire: commentaire || undefined, ...(to === 'HOMOLOGUE_RESERVES' ? { reserves } : {}) })

  return (
    <section aria-label={h.systeme} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{h.systeme}</h2>
          {h.perimetre && <p className="text-sm text-gray-600 dark:text-gray-400">{h.perimetre}</p>}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {th.statut[statut]}
            {h.dateDecision && <> · {th.decidedOn.replace('{date}', formatDate(h.dateDecision, locale))}</>}
            {h.dateFin && <> · {th.validUntil.replace('{date}', formatDate(h.dateFin, locale))}</>}
          </p>
          {h.commentaireDecision && <p className="mt-1 text-sm italic text-gray-600 dark:text-gray-400">{h.commentaireDecision}</p>}
          {h.reserves.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
              {h.reserves.map((r, i) => <li key={i}>{r.texte}{r.echeance ? ` — ${formatDate(r.echeance, locale)}` : ''}</li>)}
            </ul>
          )}
        </div>
        <button type="button" aria-label={th.close} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" onClick={onClose}><X className="h-5 w-5" aria-hidden /></button>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">{th.dossier}</h3>
        <ul className="space-y-2">
          {pieces.map((p, i) => (
            <li key={p.type} className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex min-w-64 items-center gap-2">
                <input type="checkbox" checked={p.fourni} disabled={!editable} onChange={e => setPiece(i, { fourni: e.target.checked })} />
                {th.pieces[p.type]}
              </label>
              <input aria-label={`${th.reference} — ${th.pieces[p.type]}`} placeholder={th.reference} disabled={!editable} className={`${INPUT} max-w-sm`} value={p.reference ?? ''} maxLength={200} onChange={e => setPiece(i, { reference: e.target.value })} />
            </li>
          ))}
        </ul>
        {!complet && enInstruction && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{th.dossierIncomplet}</p>}
      </div>

      {editable && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">{th.autorite}
            <select aria-label={th.autorite} className={INPUT} value={autoriteId} onChange={e => setAutoriteId(e.target.value)}>
              <option value="">{th.autoriteNone}</option>
              {membres.filter(m => m.id !== h.preparePar).map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          </label>
          <label className="text-sm">{th.duree}<input aria-label={th.duree} type="number" min={1} max={60} className={INPUT} value={dureeMois} onChange={e => setDureeMois(Number(e.target.value))} /></label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button type="button" disabled={busy} className={`${BTN} bg-blue-600 text-white hover:bg-blue-700`}
              onClick={async () => { setSaved(false); if (await onUpdate({ pieces, autoriteId: autoriteId || null, dureeMois })) setSaved(true) }}>{th.save}</button>
            {saved && <span role="status" className="text-sm text-green-700 dark:text-green-300">{th.saved}</span>}
          </div>
        </div>
      )}

      <div className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{th.decision}</h3>
        {userId === h.preparePar && statut === 'COMMISSION' && <p className="text-sm text-gray-600 dark:text-gray-400">{th.separationHint}</p>}
        {decideur && (
          <>
            <label className="block text-sm">{th.commentaire}<textarea aria-label={th.commentaire} className={INPUT} rows={2} value={commentaire} onChange={e => setCommentaire(e.target.value)} /></label>
            <div className="space-y-2">
              <p className="text-sm font-medium">{th.reserves}</p>
              {reserves.map((r, i) => (
                <div key={i} className="flex flex-wrap gap-2">
                  <input aria-label={`${th.reserveTexte} ${i + 1}`} placeholder={th.reserveTexte} className={`${INPUT} max-w-md`} value={r.texte} onChange={e => setReserves(rs => rs.map((x, k) => (k === i ? { ...x, texte: e.target.value } : x)))} />
                  <input aria-label={`${th.reserveEcheance} ${i + 1}`} type="date" className={`${INPUT} max-w-[11rem]`} value={r.echeance ?? ''} onChange={e => setReserves(rs => rs.map((x, k) => (k === i ? { ...x, echeance: e.target.value || undefined } : x)))} />
                </div>
              ))}
              <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => setReserves(rs => [...rs, { texte: '' }])}>{th.reserveAdd}</button>
            </div>
          </>
        )}
        <div className="flex flex-wrap gap-2">
          {statut === 'PREPARATION' && canPrepare && (
            <button type="button" disabled={busy} className={`${BTN} bg-blue-600 text-white hover:bg-blue-700`} onClick={() => onTransition({ to: 'COMMISSION' })}>{th.actions.COMMISSION}</button>
          )}
          {decideur && (
            <>
              <button type="button" disabled={busy} className={`${BTN} bg-green-600 text-white hover:bg-green-700`} onClick={() => decide('HOMOLOGUE')}>{th.actions.HOMOLOGUE}</button>
              <button type="button" disabled={busy || !reserves.some(r => r.texte.trim())} className={`${BTN} bg-amber-600 text-white hover:bg-amber-700`} onClick={() => decide('HOMOLOGUE_RESERVES')}>{th.actions.HOMOLOGUE_RESERVES}</button>
              <button type="button" disabled={busy} className={`${BTN} bg-red-600 text-white hover:bg-red-700`} onClick={() => decide('REFUSE')}>{th.actions.REFUSE}</button>
            </>
          )}
          {statut === 'COMMISSION' && (canPrepare || decideur) && (
            <button type="button" disabled={busy} className={`${BTN} border border-gray-300 dark:border-gray-600`} onClick={() => onTransition({ to: 'PREPARATION' })}>{th.actions.PREPARATION}</button>
          )}
          {!enInstruction && canPrepare && (
            <button type="button" disabled={busy} className={`${BTN} border border-gray-300 dark:border-gray-600`} onClick={() => onTransition({ to: 'PREPARATION' })}>{th.actions.reexamen}</button>
          )}
        </div>
      </div>
    </section>
  )
}
