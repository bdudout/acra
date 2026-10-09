'use client'

// ─── Fiche d'un tiers : offres, couverture contractuelle, usages ──────────────
// Une offre est identifiable (« SignNow Signature ») ; sa catégorie n'est qu'un attribut. Plusieurs usages d'une même offre
// (Achats, RH…) coexistent, chacun avec son processus et sa couverture contractuelle, confirmée ou « à confirmer ».

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import RevuePeriodiqueChamp from '@/components/RevuePeriodiqueChamp'
import EvaluationUsagePanel from '@/components/EvaluationUsagePanel'
import { TYPES_SERVICE_TIC } from '@/lib/registre-tic'

type NiveauEval = { menace: number; zone: string } | null
// Évaluation d'un usage (lot T1) : statut, menace et zone actuelles / cibles, prochaine réévaluation.
type EvalResume = { statut: string; actuelle: NiveauEval; cible: NiveauEval; prochaine: string | null } | null
type Usage = { id: string; useCase: string; processusNom: string | null; contractServiceId: string | null; criticite: string | null; criticiteEcart: boolean; criticiteContrat: string | null; coverage: 'CONFIRMED' | 'UNCONFIRMED'; evaluation?: EvalResume }
type Service = { id: string; nom: string; typeService: string; actif: boolean; synthese?: { menace: number; zone: string; evalues: number } | null; coveredBy: { arrangementId: string; reference: string; contractServiceId: string }[]; usages: Usage[] }
type Detail = {
  orgId: string; canManage: boolean; isAdmin: boolean
  // Revue périodique du tiers (lib/revues) : modifiable par l'organisation racine du registre seulement.
  tier?: { derniereRevue: string | null; prochaineRevue: string | null; revueModifiable: boolean; createdAt: string | null; synthese?: { menace: number; zone: string; evalues: number } | null } | null
  contracts: { id: string; reference: string; ownedHere: boolean; serviceIds: string[]; details?: Record<string, { perimetre: string | null; dateDebut: string | null; dateFin: string | null }>; beneficiaries?: { organizationId: string; nom: string; status: 'PROPOSED' | 'CONFIRMED' | 'REJECTED' }[]; proposable?: { id: string; nom: string }[] }[]
  contractServices: { id: string; arrangementId: string; reference: string; serviceId: string }[]
  services: Service[]
}

const send = (url: string, method: string, body?: object) => fetch(url, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })

export default function TierDetailPanel({ tierId }: { tierId: string }) {
  const { t, locale } = useTranslation()
  const c = t.tierDetail
  const types = t.registreTic.typeOpt as Record<string, string>
  const [detail, setDetail] = useState<Detail | null>(null)
  const [processes, setProcesses] = useState<{ id: string; nom: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [offer, setOffer] = useState({ nom: '', typeService: 'AUTRE' })
  const [coverage, setCoverage] = useState<Record<string, string[]>>({})
  const [covDetails, setCovDetails] = useState<Record<string, Record<string, { perimetre: string; dateDebut: string; dateFin: string }>>>({})
  const [proposeTo, setProposeTo] = useState<Record<string, string>>({})
  const [revue, setRevue] = useState('')
  const [evalOuverte, setEvalOuverte] = useState<string | null>(null)
  const [revueOk, setRevueOk] = useState(false)
  const [usageForms, setUsageForms] = useState<Record<string, { useCase: string; processusId: string; contractServiceId: string; criticite: string }>>({})

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/tier-registry/${tierId}`, { cache: 'no-store' })
      if (!res.ok) return
      const d = await res.json() as Detail
      setDetail(d)
      setRevue(d.tier?.derniereRevue ?? '')
      setCoverage(Object.fromEntries(d.contracts.filter(k => k.ownedHere).map(k => [k.id, k.serviceIds])))
      setCovDetails(Object.fromEntries(d.contracts.filter(k => k.ownedHere).map(k => [k.id, Object.fromEntries(Object.entries(k.details ?? {}).map(([sid, v]) => [sid, { perimetre: v.perimetre ?? '', dateDebut: v.dateDebut ?? '', dateFin: v.dateFin ?? '' }]))])))
      if (d.isAdmin) { const p = await fetch('/api/processus').then(r => r.ok ? r.json() : null).catch(() => null); setProcesses(p?.processus ?? []) }
    } catch { /* fiche indisponible */ }
  }, [tierId])
  useEffect(() => { void load() }, [load])

  if (!detail) return null
  const errorText = (code: string, extra?: { blocked?: { usages: number }[] }) => {
    if (code === 'date_invalide') return t.revues.erreur
    if (code === 'has_usages') return c.errors.has_usages.replace('{n}', String((extra?.blocked ?? []).reduce((n, b) => n + b.usages, 0)))
    return (c.errors as Record<string, string>)[code] ?? c.errors.failed
  }
  async function run(action: () => Promise<Response>) {
    setBusy(true); setError(null)
    try {
      const res = await action()
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(errorText(body.error, body)); return false }
      await load(); return true
    } catch { setError(c.errors.failed); return false }
    finally { setBusy(false) }
  }
  const ownContracts = detail.contracts.filter(k => k.ownedHere)
  const ZONE_BADGE: Record<string, string> = { danger: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200', controle: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200', veille: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-200' }
  const zoneNom: Record<string, string> = { danger: t.workshop.a3.radar.zoneDanger, controle: t.workshop.a3.radar.zoneControle, veille: t.workshop.a3.radar.zoneVeille }
  const niveau = (n: { menace: number; zone: string }) => `${n.menace.toLocaleString(locale, { maximumFractionDigits: 2 })} — ${zoneNom[n.zone] ?? n.zone}`
  const activeOffers = detail.services.filter(s => s.actif)

  return (
    <div className="mt-2 space-y-4 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      {error && <p role="alert" className="rounded-sm border border-red-300 bg-red-50 p-2 text-sm text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100">{error}</p>}
      {detail.tier?.synthese && <p className="text-xs text-gray-700 dark:text-gray-200">{t.tierEval.synthese.replace('{niveau}', '')}<span className={`rounded-full px-2 py-0.5 ${ZONE_BADGE[detail.tier.synthese.zone]}`}>{niveau(detail.tier.synthese)}</span></p>}
      {detail.tier && (detail.tier.revueModifiable ? (
        <div className="flex flex-wrap items-end gap-2">
          <RevuePeriodiqueChamp className="max-w-xs" valeur={revue} creeLe={detail.tier.createdAt} onChange={v => { setRevue(v); setRevueOk(false) }} />
          <button type="button" disabled={busy} className="btn-secondary text-sm" onClick={async () => setRevueOk(await run(() => send(`/api/tier-registry/${tierId}`, 'PATCH', { derniereRevue: revue })))}>{t.revues.enregistrer}</button>
          {revueOk && <span role="status" className="text-xs text-green-700 dark:text-green-300">{t.revues.enregistree}</span>}
        </div>
      ) : detail.tier.prochaineRevue && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{t.revues.prochaineRevue.replace('{date}', new Date(`${detail.tier.prochaineRevue}T00:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC' }))}</p>
      ))}
      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{c.offers}</h4>
      {detail.services.length === 0 && <p className="text-sm text-gray-600 dark:text-gray-300">{c.noOffers}</p>}
      <ul className="space-y-3">
        {detail.services.map(s => {
          const form = usageForms[s.id] ?? { useCase: '', processusId: '', contractServiceId: '', criticite: '' }
          const setForm = (patch: Partial<typeof form>) => setUsageForms(f => ({ ...f, [s.id]: { ...form, ...patch } }))
          const choices = detail.contractServices.filter(cs => cs.serviceId === s.id)
          return (
            <li key={s.id} className="rounded-sm border border-gray-100 p-2 text-sm dark:border-gray-800">
              <p className="font-medium text-gray-900 dark:text-gray-100">{s.nom} <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal dark:bg-gray-800">{types[s.typeService] ?? s.typeService}</span>{!s.actif && <span className="ml-2 text-xs text-gray-500">({c.inactive})</span>}</p>
              <p className="text-xs text-gray-600 dark:text-gray-300">{s.coveredBy.length ? c.covered.replace('{refs}', s.coveredBy.map(x => x.reference).join(', ')) : c.uncovered}</p>
              {s.synthese && <p className="text-xs text-gray-600 dark:text-gray-300">{t.tierEval.synthese.replace('{niveau}', '')}<span className={`rounded-full px-2 py-0.5 ${ZONE_BADGE[s.synthese.zone]}`}>{niveau(s.synthese)}</span></p>}
              {s.usages.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {s.usages.map(u => (
                    <li key={u.id} className="flex flex-wrap items-center gap-2 text-xs text-gray-800 dark:text-gray-100">
                      <span className="font-medium">{u.useCase}</span>{u.processusNom && <span>— {u.processusNom}</span>}
                      <span className={`rounded-full px-2 py-0.5 ${u.coverage === 'CONFIRMED' ? 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100' : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'}`}>{c.coverage[u.coverage]}</span>
                      {detail.isAdmin
                        ? <select aria-label={c.criticalityOf.replace('{name}', u.useCase)} className="input py-0.5 text-xs" value={u.criticite ?? ''} disabled={busy} onChange={e => void run(() => send(`/api/tier-registry/usages/${u.id}`, 'PATCH', { criticite: e.target.value }))}>
                            <option value="">{c.criticalityNone}</option>{Object.entries(c.criticalityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        : u.criticite && <span className="rounded-full bg-gray-100 px-2 py-0.5 dark:bg-gray-800">{c.criticalityLabels[u.criticite as keyof typeof c.criticalityLabels] ?? u.criticite}</span>}
                      {u.criticiteEcart && <span role="status" className="rounded-full bg-red-100 px-2 py-0.5 text-red-900 dark:bg-red-900/40 dark:text-red-100">{c.criticalityGap.replace('{contract}', c.criticalityLabels[u.criticiteContrat as keyof typeof c.criticalityLabels] ?? String(u.criticiteContrat))}</span>}
                      {u.evaluation?.actuelle
                        ? <span className={`rounded-full px-2 py-0.5 ${ZONE_BADGE[u.evaluation.actuelle.zone]}`}>{niveau(u.evaluation.actuelle)} · {t.tierEval.statuts[u.evaluation.statut as keyof typeof t.tierEval.statuts] ?? u.evaluation.statut}</span>
                        : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500 dark:bg-gray-800">{t.tierEval.nonEvalue}</span>}
                      <button type="button" className="btn-secondary px-2 py-0.5 text-xs" aria-expanded={evalOuverte === u.id} onClick={() => setEvalOuverte(evalOuverte === u.id ? null : u.id)}>{evalOuverte === u.id ? t.tierEval.masquer : t.tierEval.evaluer}</button>
                      {detail.isAdmin && <button type="button" className="btn-secondary px-2 py-0.5 text-xs" disabled={busy} aria-label={c.deleteUsage.replace('{name}', u.useCase)} onClick={() => void run(() => send(`/api/tier-registry/usages/${u.id}`, 'DELETE'))}>✕</button>}
                      {evalOuverte === u.id && <div className="basis-full"><EvaluationUsagePanel usageId={u.id} usageNom={u.useCase} onChange={() => void load()} /></div>}
                    </li>
                  ))}
                </ul>
              )}
              {detail.isAdmin && s.actif && (
                <div className="mt-2 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
                  <label className="text-xs text-gray-700 dark:text-gray-200">{c.useCase}<input aria-label={c.useCase} className="input mt-1 block w-full text-sm" value={form.useCase} maxLength={1000} onChange={e => setForm({ useCase: e.target.value })} /></label>
                  <label className="text-xs text-gray-700 dark:text-gray-200">{c.process}
                    <select aria-label={c.process} className="input mt-1 block w-full text-sm" value={form.processusId} onChange={e => setForm({ processusId: e.target.value })}>
                      <option value="">—</option>{processes.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-gray-700 dark:text-gray-200">{c.contract}
                    <select aria-label={c.contract} className="input mt-1 block w-full text-sm" value={form.contractServiceId} onChange={e => setForm({ contractServiceId: e.target.value })}>
                      <option value="">{c.outOfContract}</option>{choices.map(cs => <option key={cs.id} value={cs.id}>{cs.reference}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-gray-700 dark:text-gray-200">{c.criticality}
                    <select aria-label={c.criticality} className="input mt-1 block w-full text-sm" value={form.criticite} onChange={e => setForm({ criticite: e.target.value })}>
                      <option value="">{c.criticalityNone}</option>{Object.entries(c.criticalityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                  <button type="button" className="btn-secondary text-sm" disabled={busy || !form.useCase.trim()} onClick={() => void run(async () => {
                    const res = await send(`/api/tiers/services/${s.id}/usages`, 'POST', { organizationId: detail.orgId, useCase: form.useCase, ...(form.processusId ? { processusId: form.processusId } : {}), ...(form.contractServiceId ? { contractServiceId: form.contractServiceId } : {}), ...(form.criticite ? { criticite: form.criticite } : {}) })
                    if (res.ok) setUsageForms(f => ({ ...f, [s.id]: { useCase: '', processusId: '', contractServiceId: '', criticite: '' } }))
                    return res
                  })}>{c.addUsage}</button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {detail.canManage && (
        <form className="grid gap-2 sm:grid-cols-[2fr_1fr_auto] sm:items-end" onSubmit={e => { e.preventDefault(); if (offer.nom.trim()) void run(async () => { const res = await send(`/api/tier-registry/${tierId}/services`, 'POST', { nom: offer.nom, typeService: offer.typeService }); if (res.ok) setOffer({ nom: '', typeService: 'AUTRE' }); return res }) }}>
          <label className="text-xs text-gray-700 dark:text-gray-200">{c.offerName}<input aria-label={c.offerName} className="input mt-1 block w-full text-sm" value={offer.nom} maxLength={200} onChange={e => setOffer(o => ({ ...o, nom: e.target.value }))} /></label>
          <label className="text-xs text-gray-700 dark:text-gray-200">{c.category}
            <select aria-label={c.category} className="input mt-1 block w-full text-sm" value={offer.typeService} onChange={e => setOffer(o => ({ ...o, typeService: e.target.value }))}>
              {TYPES_SERVICE_TIC.map(k => <option key={k} value={k}>{types[k] ?? k}</option>)}
            </select>
          </label>
          <button type="submit" className="btn-secondary text-sm" disabled={busy || !offer.nom.trim()}>{c.addOffer}</button>
        </form>
      )}

      {detail.canManage && activeOffers.length > 0 && ownContracts.map(k => (
        <fieldset key={k.id} className="rounded-sm border border-gray-200 p-2 dark:border-gray-700">
          <legend className="px-1 text-xs font-medium text-gray-700 dark:text-gray-200">{c.coverageTitle.replace('{ref}', k.reference)}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {activeOffers.map(s => (
              <label key={s.id} className="inline-flex items-center gap-1 text-xs text-gray-800 dark:text-gray-100">
                <input type="checkbox" aria-label={s.nom} checked={(coverage[k.id] ?? []).includes(s.id)} onChange={() => setCoverage(cv => ({ ...cv, [k.id]: (cv[k.id] ?? []).includes(s.id) ? (cv[k.id] ?? []).filter(x => x !== s.id) : [...(cv[k.id] ?? []), s.id] }))} />{s.nom}
              </label>
            ))}
          </div>
          {activeOffers.filter(s => (coverage[k.id] ?? []).includes(s.id)).map(s => {
            const d = covDetails[k.id]?.[s.id] ?? { perimetre: '', dateDebut: '', dateFin: '' }
            const set = (patch: Partial<typeof d>) => setCovDetails(cv => ({ ...cv, [k.id]: { ...(cv[k.id] ?? {}), [s.id]: { ...d, ...patch } } }))
            return (
              <div key={s.id} className="mt-2 grid gap-2 text-xs text-gray-700 dark:text-gray-200 sm:grid-cols-[2fr_1fr_1fr]">
                <label>{c.scopeOf.replace('{name}', s.nom)}<input aria-label={c.scopeOf.replace('{name}', s.nom)} className="input mt-1 block w-full text-sm" value={d.perimetre} maxLength={2000} onChange={e => set({ perimetre: e.target.value })} /></label>
                <label>{c.coverageStart}<input type="date" aria-label={`${c.coverageStart} — ${s.nom}`} className="input mt-1 block w-full text-sm" value={d.dateDebut} onChange={e => set({ dateDebut: e.target.value })} /></label>
                <label>{c.coverageEnd}<input type="date" aria-label={`${c.coverageEnd} — ${s.nom}`} className="input mt-1 block w-full text-sm" value={d.dateFin} onChange={e => set({ dateFin: e.target.value })} /></label>
              </div>
            )
          })}
          <button type="button" className="btn-secondary mt-2 text-xs" disabled={busy} onClick={() => void run(() => send(`/api/tier-registry/contracts/${k.id}/services`, 'PUT', { serviceIds: coverage[k.id] ?? [], details: covDetails[k.id] ?? {} }))}>{c.saveCoverage}</button>
        </fieldset>
      ))}

      {detail.isAdmin && ownContracts.filter(k => (k.beneficiaries?.length ?? 0) > 0 || (k.proposable?.length ?? 0) > 0).map(k => (
        <fieldset key={`ben-${k.id}`} className="rounded-sm border border-gray-200 p-2 dark:border-gray-700">
          <legend className="px-1 text-xs font-medium text-gray-700 dark:text-gray-200">{c.beneficiariesTitle.replace('{ref}', k.reference)}</legend>
          <ul className="space-y-1 text-xs text-gray-800 dark:text-gray-100">
            {(k.beneficiaries ?? []).map(b => <li key={b.organizationId}>{b.nom} — <span className="rounded-full bg-gray-100 px-2 py-0.5 dark:bg-gray-800">{c.beneficiaryStatus[b.status]}</span></li>)}
          </ul>
          {(k.proposable?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-xs text-gray-700 dark:text-gray-200">{c.proposeTo}
                <select aria-label={c.proposeTo} className="input mt-1 block text-sm" value={proposeTo[k.id] ?? ''} onChange={e => setProposeTo(p => ({ ...p, [k.id]: e.target.value }))}>
                  <option value="">—</option>{k.proposable!.map(o => <option key={o.id} value={o.id}>{o.nom}</option>)}
                </select>
              </label>
              <button type="button" className="btn-secondary text-xs" disabled={busy || !proposeTo[k.id]} onClick={() => void run(async () => { const res = await send(`/api/tiers/contracts/${k.id}/beneficiaries`, 'POST', { organizationId: proposeTo[k.id] }); if (res.ok) setProposeTo(p => ({ ...p, [k.id]: '' })); return res })}>{c.propose}</button>
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{c.beneficiariesHint}</p>
        </fieldset>
      ))}
    </div>
  )
}
