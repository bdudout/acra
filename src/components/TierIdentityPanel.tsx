'use client'

// ─── Identités de tiers (page Tiers) ─────────────────────────────────────────
// Une identité = une personne morale. Liste des tiers de l'organisation avec leur couverture (cyber / TIC) et file de rapprochement
// des arrangements TIC non rattachés : candidats proposés avec leur raison, lien posé seulement au clic, jamais automatiquement.

import { Fragment, useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import TierDetailPanel from '@/components/TierDetailPanel'

type Candidate = { tierId: string; nom: string; reason: 'LEI' | 'NAME' | 'ALIAS'; strength: 'STRONG' | 'WEAK' }
type TierRow = { id: string; nom: string; lei: string | null; pays: string | null; analysesCount: number; arrangements: { id: string; reference: string }[]; coverage: 'CYBER_ONLY' | 'TIC_ONLY' | 'CYBER_AND_TIC' | 'UNUSED' }
type Unlinked = { id: string; reference: string; prestataireNom: string; lei: string | null; candidates: Candidate[] }
type Proposal = { arrangementId: string; reference: string; prestataireNom: string; ownerNom: string }
type Registry = { active: boolean; canManage?: boolean; isAdmin?: boolean; orgId?: string; tiers: TierRow[]; unlinkedArrangements: Unlinked[]; proposals?: Proposal[] }
type MergePreview = { ok: boolean; error?: string; source: { id: string; nom: string }; target: { id: string; nom: string }; counts: { arrangements: number; parties: number; services: number; usages: number } }
type Duplicate = { payload: { nom: string; lei?: string | null; pays?: string; linkArrangementIds?: string[] }; candidates: Candidate[] }

const send = (url: string, method: string, body: object) => fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const post = (url: string, body: object) => send(url, 'POST', body)

export default function TierIdentityPanel() {
  const { t } = useTranslation()
  const c = t.tierIdentity
  const [data, setData] = useState<Registry | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null)
  const [form, setForm] = useState({ nom: '', lei: '', pays: '' })
  const [open, setOpen] = useState<string | null>(null)
  const [mergeFrom, setMergeFrom] = useState<string | null>(null)
  const [mergeTarget, setMergeTarget] = useState('')
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null)

  const load = useCallback(async () => {
    try { const res = await fetch('/api/tier-registry', { cache: 'no-store' }); if (res.ok) setData(await res.json() as Registry) } catch { /* lecture indisponible : panneau masqué */ }
  }, [])
  useEffect(() => { void load() }, [load])

  if (!data?.active) return null
  const canManage = data.canManage === true
  const reasonLabel = (r: Candidate['reason']) => c.reasons[r]
  const errorText = (code: string) => (c.errors as Record<string, string>)[code] ?? c.errors.failed

  async function create(payload: Duplicate['payload'], confirmNew = false) {
    setBusy(true); setError(null)
    try {
      const res = await post('/api/tier-registry', { ...payload, ...(confirmNew ? { confirmNew: true } : {}) })
      const body = await res.json().catch(() => ({}))
      if (res.status === 409 && body.error === 'possible_duplicate') { setDuplicate({ payload, candidates: body.candidates ?? [] }); return }
      if (!res.ok) { setError(errorText(body.error)); return }
      setDuplicate(null); setForm({ nom: '', lei: '', pays: '' }); await load()
    } catch { setError(c.errors.failed) }
    finally { setBusy(false) }
  }
  async function decide(arrangementId: string, decision: 'CONFIRM' | 'REJECT') {
    if (!data?.orgId) return
    setBusy(true); setError(null)
    try {
      const res = await send(`/api/tiers/contracts/${arrangementId}/beneficiaries/${data.orgId}`, 'PATCH', { decision })
      if (!res.ok) { setError(errorText((await res.json().catch(() => ({}))).error)); return }
      await load()
    } catch { setError(c.errors.failed) }
    finally { setBusy(false) }
  }
  async function previewMerge(sourceId: string, targetId: string) {
    setMergeTarget(targetId); setMergePreview(null); setError(null)
    if (!targetId) return
    try {
      const res = await fetch(`/api/tier-registry/merge?sourceId=${encodeURIComponent(sourceId)}&targetId=${encodeURIComponent(targetId)}`, { cache: 'no-store' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(errorText(body.error)); return }
      setMergePreview(body as MergePreview)
    } catch { setError(c.errors.failed) }
  }
  async function confirmMerge() {
    if (!mergeFrom || !mergeTarget) return
    setBusy(true); setError(null)
    try {
      const res = await send('/api/tier-registry/merge', 'POST', { sourceId: mergeFrom, targetId: mergeTarget })
      if (!res.ok) { const code = (await res.json().catch(() => ({}))).error as string; setError((c.mergeBlocked as Record<string, string>)[code] ?? errorText(code)); return }
      setMergeFrom(null); setMergeTarget(''); setMergePreview(null); setOpen(null); await load()
    } catch { setError(c.errors.failed) }
    finally { setBusy(false) }
  }
  async function link(arrangementId: string, tierId: string | null) {
    setBusy(true); setError(null)
    try {
      const res = await post('/api/tier-registry/link', { arrangementId, tierId })
      if (!res.ok) { setError(errorText((await res.json().catch(() => ({}))).error)); return }
      await load()
    } catch { setError(c.errors.failed) }
    finally { setBusy(false) }
  }

  return (
    <section className="card mb-6 space-y-4 p-4" aria-label={c.title}>
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{c.title}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">{c.hint}</p>
      </div>
      {error && <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100">{error}</p>}
      {duplicate && (
        <div role="alert" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">{c.duplicateTitle}</p>
          <ul className="mt-1 list-disc pl-5">{duplicate.candidates.map(x => <li key={x.tierId}>{x.nom} — {reasonLabel(x.reason)}</li>)}</ul>
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => void create(duplicate.payload, true)}>{c.createAnyway}</button>
            <button type="button" className="btn-secondary text-sm" onClick={() => setDuplicate(null)}>{c.cancel}</button>
          </div>
        </div>
      )}

      {(data.proposals?.length ?? 0) > 0 && (
        <div className="rounded border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
          <h3 className="text-sm font-semibold text-blue-950 dark:text-blue-100">{c.proposalsTitle}</h3>
          <p className="text-xs text-blue-900 dark:text-blue-200">{c.proposalsHint}</p>
          <ul className="mt-2 space-y-2">
            {data.proposals!.map(p => (
              <li key={p.arrangementId} className="flex flex-wrap items-center gap-2 text-sm text-blue-950 dark:text-blue-100">
                <span><span className="font-medium">{p.reference}</span> — {p.prestataireNom} <span className="text-xs">({c.proposedBy.replace('{name}', p.ownerNom)})</span></span>
                {data.isAdmin && (
                  <span className="flex gap-2">
                    <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void decide(p.arrangementId, 'CONFIRM')}>{c.confirm}</button>
                    <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => void decide(p.arrangementId, 'REJECT')}>{c.reject}</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {canManage && (
        <form className="grid gap-2 sm:grid-cols-[2fr_2fr_1fr_auto] sm:items-end" onSubmit={e => { e.preventDefault(); if (form.nom.trim()) void create({ nom: form.nom, lei: form.lei || null, ...(form.pays ? { pays: form.pays } : {}) }) }}>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-200">{c.formName}
            <input aria-label={c.formName} className="input mt-1 block w-full text-sm" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} maxLength={200} />
          </label>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-200">{c.formLei}
            <input aria-label={c.formLei} className="input mt-1 block w-full text-sm" value={form.lei} onChange={e => setForm(f => ({ ...f, lei: e.target.value }))} maxLength={24} />
          </label>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-200">{c.formCountry}
            <input aria-label={c.formCountry} className="input mt-1 block w-full text-sm" value={form.pays} onChange={e => setForm(f => ({ ...f, pays: e.target.value.toUpperCase() }))} maxLength={2} placeholder="FR" />
          </label>
          <button type="submit" className="btn-primary text-sm" disabled={busy || !form.nom.trim()}>{c.create}</button>
        </form>
      )}

      {data.tiers.length === 0
        ? <p className="text-sm text-gray-600 dark:text-gray-300">{c.empty}</p>
        : (
          <div className="overflow-x-auto">
            <table aria-label={c.title} className="w-full text-sm">
              <thead className="text-left text-xs text-gray-600 dark:text-gray-300"><tr><th className="px-2 py-1">{c.colName}</th><th className="px-2 py-1">{c.colLei}</th><th className="px-2 py-1">{c.colCoverage}</th><th className="px-2 py-1">{c.colArrangements}</th><th className="px-2 py-1">{c.colAnalyses}</th><th className="px-2 py-1"><span className="sr-only">{c.offersAndUsages}</span></th></tr></thead>
              <tbody>{data.tiers.map(tier => (
                <Fragment key={tier.id}>
                  <tr className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-2 py-1 font-medium text-gray-900 dark:text-gray-100">{tier.nom}{tier.pays && <span className="ml-2 text-xs text-gray-500">{tier.pays}</span>}</td>
                    <td className="px-2 py-1 font-mono text-xs text-gray-600 dark:text-gray-300">{tier.lei ?? '—'}</td>
                    <td className="px-2 py-1"><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-100">{c.coverage[tier.coverage]}</span></td>
                    <td className="px-2 py-1 text-gray-700 dark:text-gray-200">{tier.arrangements.map(a => a.reference).join(', ') || '—'}</td>
                    <td className="px-2 py-1 text-gray-700 dark:text-gray-200">{tier.analysesCount}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">{canManage && data.tiers.length > 1 && <button type="button" className="btn-secondary mr-1 text-xs" aria-expanded={mergeFrom === tier.id} aria-label={`${c.merge} — ${tier.nom}`} onClick={() => { setMergeFrom(m => m === tier.id ? null : tier.id); setMergeTarget(''); setMergePreview(null) }}>{c.merge}</button>}<button type="button" className="btn-secondary text-xs" aria-expanded={open === tier.id} aria-label={`${c.offersAndUsages} — ${tier.nom}`} onClick={() => setOpen(o => o === tier.id ? null : tier.id)}>{c.offersAndUsages}</button></td>
                  </tr>
                  {mergeFrom === tier.id && (
                    <tr><td colSpan={6} className="px-2 pb-3">
                      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                        <p>{c.mergeHint.replace('{name}', tier.nom)}</p>
                        <label className="mt-2 block text-xs font-medium">{c.mergeInto}
                          <select aria-label={c.mergeInto} className="input mt-1 block w-full text-sm sm:w-80" value={mergeTarget} onChange={e => void previewMerge(tier.id, e.target.value)}>
                            <option value="">—</option>{data.tiers.filter(x => x.id !== tier.id).map(x => <option key={x.id} value={x.id}>{x.nom}</option>)}
                          </select>
                        </label>
                        {mergePreview && (
                          <div data-testid="merge-preview" className="mt-2 text-xs">
                            {mergePreview.ok
                              ? <p>{c.mergeMoves.replace('{arr}', String(mergePreview.counts.arrangements)).replace('{pp}', String(mergePreview.counts.parties)).replace('{svc}', String(mergePreview.counts.services)).replace('{use}', String(mergePreview.counts.usages))}</p>
                              : <p role="alert">{(c.mergeBlocked as Record<string, string>)[mergePreview.error ?? ''] ?? c.errors.failed}</p>}
                          </div>
                        )}
                        {mergePreview?.ok && <div className="mt-2 flex gap-2"><button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void confirmMerge()}>{c.mergeConfirm}</button><button type="button" className="btn-secondary text-xs" onClick={() => setMergeFrom(null)}>{c.cancel}</button></div>}
                      </div>
                    </td></tr>
                  )}
                  {open === tier.id && <tr><td colSpan={6} className="px-2 pb-3"><TierDetailPanel tierId={tier.id} /></td></tr>}
                </Fragment>))}</tbody>
            </table>
          </div>
        )}

      {data.unlinkedArrangements.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{c.toLinkTitle.replace('{n}', String(data.unlinkedArrangements.length))}</h3>
          <p className="text-xs text-gray-600 dark:text-gray-300">{c.toLinkHint}</p>
          <ul className="mt-2 space-y-2">
            {data.unlinkedArrangements.map(a => (
              <li key={a.id} className="rounded border border-gray-200 p-2 text-sm dark:border-gray-700">
                <p className="text-gray-900 dark:text-gray-100"><span className="font-medium">{a.reference}</span> — {a.prestataireNom}{a.lei && <span className="ml-2 font-mono text-xs text-gray-500">{a.lei}</span>}</p>
                {canManage && (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {a.candidates.map(x => (
                      <span key={x.tierId} className="inline-flex items-center gap-1">
                        <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => void link(a.id, x.tierId)}>{c.linkTo.replace('{name}', x.nom)}</button>
                        <span className="text-xs text-gray-500">({reasonLabel(x.reason)})</span>
                      </span>
                    ))}
                    <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => void create({ nom: a.prestataireNom, lei: a.lei, linkArrangementIds: [a.id] })}>{c.createFrom}</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
