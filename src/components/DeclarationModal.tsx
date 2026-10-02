'use client'

// ─── Déclaration réglementaire d'un incident (DORA, NIS2, CRA, RGPD, SEC, NYDFS, HIPAA, interne…) ────────────────────────
// Un seul écran par incident : pour chaque autorité applicable, ses phases (échéance, statut), la case « formalisée en interne »
// avec la date de dépôt (qui arrête les relances), la référence de l'accusé et l'export JSON d'aide à la déclaration. DORA : champs
// de l'annexe I de l'ITS 2025/302 à compléter. ACRA ne transmet rien : l'entité dépose auprès de l'autorité compétente.

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { DORA_ITS_FIELDS, type DoraStage } from '@/lib/incident-declaration'
import type { HorlogeRegimeJson } from '@/components/NotificationsPanel'

export interface DeclarationIncidentView {
  id: string; intitule: string
  dora?: { classe: string; echeances: { phase: string; echeance: string | null; statut: string; soumiseLe: string | null }[] } | null
  horloges: HorlogeRegimeJson[]
  attributs?: { significatif?: boolean; donneesPersonnelles?: boolean; contractuel?: boolean; regimes?: string[] }
}
export interface RegimeDisponible { code: string; label?: string; labelKey?: string; autorite?: string }

const DORA_FIELD: Record<string, 'doraInitialeSoumiseLe' | 'doraIntermediaireSoumiseLe' | 'doraFinaleSoumiseLe'> = { INITIALE: 'doraInitialeSoumiseLe', INTERMEDIAIRE: 'doraIntermediaireSoumiseLe', FINALE: 'doraFinaleSoumiseLe' }
const DORA_STAGE: Record<string, DoraStage> = { INITIALE: 'INITIAL', INTERMEDIAIRE: 'INTERMEDIATE', FINALE: 'FINAL' }
const BADGE: Record<string, string> = {
  SOUMIS: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300', EN_RETARD: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  A_FAIRE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300', EN_ATTENTE: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300', INAPPLICABLE: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
}
const pad = (n: number) => String(n).padStart(2, '0')
/** ISO → valeur d'un champ datetime-local (heure locale). */
const toLocal = (iso: string | null | undefined) => { const d = iso ? new Date(iso) : new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }
const toIso = (local: string) => new Date(local).toISOString()

export default function DeclarationModal({ incident, available, canQualify, onClose, onChanged }: {
  incident: DeclarationIncidentView; available: RegimeDisponible[]; canQualify: boolean; onClose: () => void; onChanged: () => void
}) {
  const { t, locale } = useTranslation()
  const n = t.incidents
  const d = n.decl
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [when, setWhen] = useState<Record<string, string>>({})
  const [refs, setRefs] = useState<Record<string, string>>({})
  const [stage, setStage] = useState<DoraStage | null>(null)
  const [compl, setCompl] = useState<Record<string, string>>({})
  const [add, setAdd] = useState('')
  const tr = (key?: string, fallback?: string) => (key ? (key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], t) as string | undefined) : undefined) ?? fallback ?? key ?? ''
  const fmt = (iso: string) => new Date(iso).toLocaleString(locale)
  const stageName = d.stages as Record<string, string>
  const statuts = { ...(n.notifStatuts as Record<string, string>), ...(n.doraStatuts as Record<string, string>) }

  useEffect(() => {
    fetch(`/api/incidents/${incident.id}/declaration`).then(r => (r.ok ? r.json() : null)).then(j => {
      if (j?.declaration) setCompl(Object.fromEntries(Object.entries(j.declaration as Record<string, unknown>).map(([k, v]) => [k, Array.isArray(v) ? v.join('; ') : String(v)])))
    }).catch(() => {})
  }, [incident.id])

  async function call(url: string, method: string, body?: object) {
    setBusy(true); setError(null); setMsg(null)
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError((n.errors as Record<string, string>)[data.error] ?? d.failed); return false }
      onChanged(); return true
    } catch { setError(d.failed); return false } finally { setBusy(false) }
  }
  const setDora = (phase: string, soumise: boolean) => call(`/api/incidents/${incident.id}`, 'PATCH', { [DORA_FIELD[phase]]: soumise ? toIso(when[`DORA/${phase}`] ?? toLocal(null)) : null })
  const setNotif = (regime: string, phase: string, soumise: boolean) => soumise
    ? call(`/api/incidents/${incident.id}/notifications`, 'POST', { regime, phase, soumisLe: toIso(when[`${regime}/${phase}`] ?? toLocal(null)), ...((refs[`${regime}/${phase}`] ?? '').trim() ? { reference: refs[`${regime}/${phase}`].trim() } : {}) })
    : call(`/api/incidents/${incident.id}/notifications`, 'DELETE', { regime, phase })
  async function saveCompl() {
    if (await call(`/api/incidents/${incident.id}/declaration`, 'PUT', { declaration: compl })) setMsg(d.saved)
  }
  async function addRegulator() {
    if (!add) return
    const a = incident.attributs ?? {}
    if (await call(`/api/incidents/${incident.id}`, 'PATCH', { attributs: { ...a, regimes: [...new Set([...(a.regimes ?? []), add])] } })) setAdd('')
  }

  const known = new Set(incident.horloges.map(h => h.regime))
  const addable = available.filter(r => !known.has(r.code))
  const editable = (s: string) => DORA_ITS_FIELDS.filter(f => f.editable && (f.stage === 'GENERAL' || f.stage === s))
  const jsonHref = (q: string) => `/api/incidents/${incident.id}/declaration?${q}&download=1`
  const showDora = !!incident.dora

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-label={d.title} className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[88vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{d.title}</p><p className="text-xs text-gray-500 dark:text-gray-400">{incident.intitule}</p></div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none" aria-label={d.close}>×</button>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{d.hint}</p>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        {msg && <p role="status" className="text-xs text-green-700 dark:text-green-300">{msg}</p>}

        {showDora && (
          <section aria-label={d.dora} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{d.dora}</h3>
            {incident.dora!.classe !== 'MAJEUR' && <p className="text-[11px] italic text-gray-500">{d.notMajor}</p>}
            <ul className="mt-2 space-y-3">
              {incident.dora!.echeances.map(e => {
                const key = `DORA/${e.phase}`; const done = !!e.soumiseLe; const st = DORA_STAGE[e.phase]
                return (
                  <li key={e.phase} className="border-t border-gray-100 dark:border-gray-800 pt-2 first:border-t-0 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm text-gray-700 dark:text-gray-200">{stageName[st]}</p>
                        <p className="text-[11px] text-gray-400">{d.deadline} : {e.echeance ? fmt(e.echeance) : '—'}{e.soumiseLe && ` · ${n.notifSoumisLe} ${fmt(e.soumiseLe)}`}</p>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${BADGE[e.statut] ?? BADGE.EN_ATTENTE}`}>{statuts[e.statut] ?? e.statut}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                      {canQualify && incident.dora!.classe === 'MAJEUR' && (
                        <>
                          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={done} disabled={busy} onChange={ev => void setDora(e.phase, ev.target.checked)} />{d.formalised}</label>
                          {!done && <label className="inline-flex items-center gap-1">{d.formalisedOn}<input type="datetime-local" aria-label={`${d.formalisedOn} — ${stageName[st]}`} value={when[key] ?? toLocal(null)} onChange={ev => setWhen(w => ({ ...w, [key]: ev.target.value }))} className="px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 text-xs" /></label>}
                        </>
                      )}
                      {canQualify && <button type="button" className="btn-secondary text-[11px]" aria-expanded={stage === st} onClick={() => setStage(s => (s === st ? null : st))}>{d.complete}</button>}
                      {canQualify && <a className="btn-secondary text-[11px]" href={jsonHref(`regime=DORA&stage=${st}`)} download>{d.exportJson} — {stageName[st]}</a>}
                    </div>
                    {stage === st && canQualify && (
                      <div className="mt-2 rounded border border-gray-100 dark:border-gray-700 p-2">
                        <p className="text-[11px] font-medium text-gray-600 dark:text-gray-300">{d.completeTitle}</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {editable(st).map(f => (
                            <label key={f.id} className="text-[11px] text-gray-600 dark:text-gray-300">{f.id} — {f.name}
                              {f.kind === 'bool'
                                ? <select aria-label={`${f.id} ${f.name}`} className="mt-0.5 block w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 px-1.5 py-1 text-xs" value={compl[f.id] ?? ''} onChange={ev => setCompl(c => ({ ...c, [f.id]: ev.target.value }))}><option value="">—</option><option value="true">{d.yes}</option><option value="false">{d.no}</option></select>
                                : <input aria-label={`${f.id} ${f.name}`} className="mt-0.5 block w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 px-1.5 py-1 text-xs" value={compl[f.id] ?? ''} maxLength={2000} onChange={ev => setCompl(c => ({ ...c, [f.id]: ev.target.value }))} />}
                            </label>
                          ))}
                        </div>
                        <button type="button" className="btn-primary text-xs mt-2" disabled={busy} onClick={() => void saveCompl()}>{d.save}</button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {incident.horloges.map(h => (
          <section key={h.regime} aria-label={h.label ?? tr(h.labelKey, h.regime)} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{h.label ?? tr(h.labelKey, h.regime)}</h3>
            <ul className="mt-2 space-y-3">
              {h.phases.map(p => {
                const key = `${h.regime}/${p.code}`; const done = p.statut === 'SOUMIS'
                return (
                  <li key={p.code} className="border-t border-gray-100 dark:border-gray-800 pt-2 first:border-t-0 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm text-gray-700 dark:text-gray-200">{p.label ?? tr(p.labelKey, p.code)}</p>
                        <p className="text-[11px] text-gray-400">{d.deadline} : {p.echeance ? fmt(p.echeance) : '—'}{p.soumisLe && ` · ${n.notifSoumisLe} ${fmt(p.soumisLe)}`}{p.reference && ` · ${p.reference}`}{p.tardive && ` · ${n.notifTardive}`}</p>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${BADGE[p.statut] ?? BADGE.EN_ATTENTE}`}>{statuts[p.statut] ?? p.statut}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                      {canQualify && (
                        <>
                          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={done} disabled={busy} aria-label={`${d.formalised} — ${p.label ?? tr(p.labelKey, p.code)}`} onChange={ev => void setNotif(h.regime, p.code, ev.target.checked)} />{d.formalised}</label>
                          {!done && (
                            <>
                              <label className="inline-flex items-center gap-1">{d.formalisedOn}<input type="datetime-local" aria-label={`${d.formalisedOn} — ${p.label ?? tr(p.labelKey, p.code)}`} value={when[key] ?? toLocal(null)} onChange={ev => setWhen(w => ({ ...w, [key]: ev.target.value }))} className="px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 text-xs" /></label>
                              <input aria-label={d.reference} placeholder={d.reference} value={refs[key] ?? ''} maxLength={120} onChange={ev => setRefs(r => ({ ...r, [key]: ev.target.value }))} className="px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 text-xs w-40" />
                            </>
                          )}
                        </>
                      )}
                      {canQualify && <a className="btn-secondary text-[11px]" href={jsonHref(`regime=${encodeURIComponent(h.regime)}&phase=${encodeURIComponent(p.code)}`)} download>{d.exportJson}</a>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

        {!showDora && incident.horloges.length === 0 && <p className="text-sm italic text-gray-500">{d.none}</p>}

        {canQualify && addable.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 dark:border-gray-700 pt-3">
            <label className="text-xs text-gray-600 dark:text-gray-300">{d.addRegulator}
              <select aria-label={d.addRegulator} value={add} onChange={e => setAdd(e.target.value)} className="ml-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 px-2 py-1 text-xs">
                <option value="">{d.addPlaceholder}</option>
                {addable.map(r => <option key={r.code} value={r.code}>{r.label ?? tr(r.labelKey, r.code)}</option>)}
              </select>
            </label>
            <button type="button" className="btn-secondary text-xs" disabled={busy || !add} onClick={() => void addRegulator()}>{d.add}</button>
          </div>
        )}
        <p className="text-[11px] text-gray-400">{d.jsonNotice}</p>
      </div>
    </div>
  )
}
