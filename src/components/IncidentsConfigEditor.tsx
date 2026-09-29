'use client'

// ─── Configuration « Incidents & pertes » (ADMIN de l'organisation) ───────────
// Régimes de notification (activation, délais, régimes personnalisés), devise de
// référence et taux, seuils de collecte / grande perte, catalogues de types.
// Émet la configuration au format stocké (configToRaw) ; l'API la nettoie.

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { configToRaw, type IncidentsConfig, type IncidentsConfigRaw, type CatalogueItem } from '@/lib/incidents-config'
import type { Regime } from '@/lib/notification-regimes'

const inp = 'px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)

export default function IncidentsConfigEditor({ config, onSave, busy }: { config: IncidentsConfig; onSave: (raw: IncidentsConfigRaw) => void; busy: boolean }) {
  const { t } = useTranslation()
  const n = t.incidents
  const tr = (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], t) as string ?? key
  const [c, setC] = useState<IncidentsConfig>(config)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ label: '', declencheur: 'MANUEL', phase: '', delaiH: '24' })
  const [newTaux, setNewTaux] = useState({ devise: '', taux: '' })
  const [newType, setNewType] = useState({ ev: '', perte: '' })

  const regimeLabel = (r: Regime) => r.label ?? (r.labelKey ? tr(r.labelKey) : r.code)
  const itemLabel = (x: CatalogueItem) => x.label ?? (x.labelKey ? tr(x.labelKey) : x.code)
  const setRegime = (code: string, patch: Partial<Regime>) => setC(v => ({ ...v, regimes: v.regimes.map(r => r.code === code ? { ...r, ...patch } : r) }))
  const setDelai = (rc: string, pc: string, h: number) => setC(v => ({ ...v, regimes: v.regimes.map(r => r.code === rc ? { ...r, phases: r.phases.map(p => p.code === pc ? { ...p, delai: p.delai.h !== undefined ? { h } : p.delai } : p) } : r) }))
  const num = (s: string): number | null => (s.trim() === '' ? null : Number(s))

  function addRegime() {
    const label = draft.label.trim(); const phase = draft.phase.trim(); const h = Number(draft.delaiH)
    if (!label || !phase || !(h > 0)) return
    let code = slug(label) || 'REGIME'
    while (c.regimes.some(r => r.code === code)) code += '_2'
    const declencheur = draft.declencheur as Regime['declencheur']
    setC(v => ({ ...v, regimes: [...v.regimes, { code, label, declencheur, actif: true, custom: true, phases: [{ code: slug(phase) || 'PHASE', label: phase, delai: { h }, apres: 'CONNAISSANCE' }] }] }))
    setDraft({ label: '', declencheur: 'MANUEL', phase: '', delaiH: '24' }); setAdding(false)
  }
  function addCatalogue(key: 'typesEvenement' | 'typesPerte', label: string) {
    const l = label.trim(); if (!l) return
    let code = slug(l) || 'TYPE'
    while (c[key].some(x => x.code === code)) code += '_2'
    setC(v => ({ ...v, [key]: [...v[key], { code, label: l, actif: true, custom: true }] }))
  }
  const toggleItem = (key: 'typesEvenement' | 'typesPerte', code: string) => setC(v => ({ ...v, [key]: v[key].map(x => x.code === code ? { ...x, actif: !x.actif } : x) }))

  return (
    <section className="card p-4 space-y-5" aria-label={n.configTitle}>
      <div><h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{n.configTitle}</h2><p className="text-xs text-gray-500">{n.configHint}</p></div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase text-gray-500">{n.regimesTitle}</h3>
        {c.regimes.map(r => (
          <div key={r.code} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-100">
              <input type="checkbox" aria-label={`${regimeLabel(r)} — ${n.regimeActif}`} checked={r.actif} onChange={e => setRegime(r.code, { actif: e.target.checked })} />
              {regimeLabel(r)}
            </label>
            <div className="mt-2 flex flex-wrap gap-3">
              {r.phases.map(p => {
                const nom = p.label ?? (p.labelKey ? tr(p.labelKey) : p.code)
                return p.delai.h !== undefined ? (
                  <label key={p.code} className="text-xs text-gray-500">{nom} — {n.delaiH}
                    <input type="number" min="1" aria-label={`${nom} — ${n.delaiH}`} value={p.delai.h} onChange={e => setDelai(r.code, p.code, Number(e.target.value))} className={`${inp} block w-24 mt-0.5`} />
                  </label>
                ) : (
                  <span key={p.code} className="text-xs text-gray-500">{nom} — {p.delai.mois} {n.delaiMois.toLowerCase()}</span>
                )
              })}
            </div>
          </div>
        ))}
        {!adding && <button type="button" onClick={() => setAdding(true)} className="text-xs text-ebios-700 hover:underline">{n.regimeAdd}</button>}
        {adding && (
          <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              <input aria-label={n.regimeNom} placeholder={n.regimeNom} value={draft.label} maxLength={120} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} className={`${inp} w-64`} />
              <select aria-label={n.regimeDeclencheur} value={draft.declencheur} onChange={e => setDraft(d => ({ ...d, declencheur: e.target.value }))} className={inp}>
                {(['MANUEL', 'TOUJOURS', 'INCIDENT_SIGNIFICATIF', 'DONNEES_PERSONNELLES', 'CONTRACTUEL'] as const).map(x => <option key={x} value={x}>{(n.declencheurs as Record<string, string>)[x]}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <input aria-label={n.phaseNom} placeholder={n.phaseNom} value={draft.phase} maxLength={120} onChange={e => setDraft(d => ({ ...d, phase: e.target.value }))} className={`${inp} w-64`} />
              <input type="number" min="1" aria-label={n.phaseDelai} value={draft.delaiH} onChange={e => setDraft(d => ({ ...d, delaiH: e.target.value }))} className={`${inp} w-24`} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={addRegime} className="btn-secondary text-xs">{n.regimeValider}</button>
              <button type="button" onClick={() => setAdding(false)} className="text-xs text-gray-500 hover:underline">{n.cancel}</button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase text-gray-500">{n.seuilsTitle}</h3>
        <div className="flex flex-wrap gap-3">
          <label className="text-xs text-gray-500">{n.deviseReference}
            <input aria-label={n.deviseReference} value={c.deviseReference} maxLength={3} onChange={e => setC(v => ({ ...v, deviseReference: e.target.value.toUpperCase() }))} className={`${inp} block w-20 mt-0.5`} />
          </label>
          <label className="text-xs text-gray-500">{n.seuilCollecte}
            <input type="number" min="0" aria-label={n.seuilCollecte} value={c.seuilCollecte ?? ''} onChange={e => setC(v => ({ ...v, seuilCollecte: num(e.target.value) }))} className={`${inp} block w-40 mt-0.5`} />
          </label>
          <label className="text-xs text-gray-500">{n.seuilGrandePerte}
            <input type="number" min="0" aria-label={n.seuilGrandePerte} value={c.seuilGrandePerte ?? ''} onChange={e => setC(v => ({ ...v, seuilGrandePerte: num(e.target.value) }))} className={`${inp} block w-40 mt-0.5`} />
          </label>
        </div>
        <p className="text-xs text-gray-500">{n.tauxTitle}</p>
        <ul className="flex flex-wrap gap-2">
          {Object.entries(c.taux).map(([d, v]) => (
            <li key={d} className="text-xs rounded bg-gray-100 dark:bg-gray-800 px-2 py-1">{d} → {v} <button type="button" aria-label={`${n.retirer} ${d}`} onClick={() => setC(x => { const t2 = { ...x.taux }; delete t2[d]; return { ...x, taux: t2 } })} className="text-red-500 ml-1">×</button></li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input aria-label={n.ligneDevise} placeholder={n.ligneDevise} value={newTaux.devise} maxLength={3} onChange={e => setNewTaux(x => ({ ...x, devise: e.target.value.toUpperCase() }))} className={`${inp} w-20`} />
          <input type="number" step="0.0001" min="0" aria-label={n.tauxTitle} value={newTaux.taux} onChange={e => setNewTaux(x => ({ ...x, taux: e.target.value }))} className={`${inp} w-28`} />
          <button type="button" onClick={() => { const v = Number(newTaux.taux); if (/^[A-Z]{3}$/.test(newTaux.devise) && v > 0) { setC(x => ({ ...x, taux: { ...x.taux, [newTaux.devise]: v } })); setNewTaux({ devise: '', taux: '' }) } }} className="text-xs text-ebios-700 hover:underline">{n.tauxAdd}</button>
        </div>
      </div>

      {(['typesEvenement', 'typesPerte'] as const).map(key => (
        <div key={key} className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase text-gray-500">{key === 'typesEvenement' ? n.typesEvenementTitle : n.typesPerteTitle}</h3>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {c[key].map(x => (
              <li key={x.code}><label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200">
                <input type="checkbox" aria-label={`${itemLabel(x)} — ${n.typeActif}`} checked={x.actif} onChange={() => toggleItem(key, x.code)} />{itemLabel(x)}
              </label></li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input aria-label={`${key === 'typesEvenement' ? n.typesEvenementTitle : n.typesPerteTitle} — ${n.typeAdd}`} placeholder={n.typeAdd} value={key === 'typesEvenement' ? newType.ev : newType.perte}
              onChange={e => setNewType(x => key === 'typesEvenement' ? { ...x, ev: e.target.value } : { ...x, perte: e.target.value })} maxLength={120} className={`${inp} w-64`} />
            <button type="button" onClick={() => { addCatalogue(key, key === 'typesEvenement' ? newType.ev : newType.perte); setNewType(x => key === 'typesEvenement' ? { ...x, ev: '' } : { ...x, perte: '' }) }} className="text-xs text-ebios-700 hover:underline">{n.typeAdd}</button>
          </div>
        </div>
      ))}

      <button type="button" disabled={busy} onClick={() => onSave(configToRaw(c))} className="btn-primary text-sm disabled:opacity-50">{n.save}</button>
    </section>
  )
}
