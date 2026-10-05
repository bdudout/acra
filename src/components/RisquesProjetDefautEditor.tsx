'use client'

// ─── Configuration › Projets : risques présents par défaut dans chaque projet 360 ─
// Catalogue ACRA (cocher / décocher) + risques ajoutés par l'organisation ; enregistré dans
// OrganizationConfig.risquesProjetDefaut (hérité, assaini côté serveur). Cf. lib/projet360-socle.

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { RISQUES_PROJET_SOCLE, sanitizeSocleConfig, type SocleConfig } from '@/lib/projet360-socle'
import { DOMAINES_360 } from '@/lib/projet360'

const IDX = { fr: 0, en: 1, de: 2, es: 3, it: 4 } as const
const field = 'rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600'

export default function RisquesProjetDefautEditor({ isAdmin }: { isAdmin: boolean }) {
  const { t, locale } = useTranslation()
  const r = t.risquesProjetDefaut
  const domaines = t.projet360.domaines as Record<string, string>
  const [cfg, setCfg] = useState<SocleConfig | null>(null)
  const [nom, setNom] = useState('')
  const [domaine, setDomaine] = useState('PROJECT')
  const [gravite, setGravite] = useState(2)
  const [vraisemblance, setVraisemblance] = useState(2)
  const [msg, setMsg] = useState<string | null>(null)
  const [moduleInactif, setModuleInactif] = useState(false)

  useEffect(() => {
    fetch('/api/admin/organization-config', { cache: 'no-store' }).then(res => (res.ok ? res.json() : null))
      .then(d => { setCfg(sanitizeSocleConfig(d?.risquesProjetDefaut)); setModuleInactif(d?.projets360Active === false) }).catch(() => setCfg(sanitizeSocleConfig(null)))
  }, [])
  if (!cfg) return null

  const i = IDX[locale as keyof typeof IDX] ?? 0
  const toggle = (code: string) => setCfg(c => c && ({ ...c, desactives: c.desactives.includes(code) ? c.desactives.filter(x => x !== code) : [...c.desactives, code] }))
  function ajouter() {
    if (!nom.trim()) return
    setCfg(c => c && ({ ...c, ajoutes: [...c.ajoutes, { id: `a${Date.now().toString(36)}`, intitule: nom.trim(), domaine: domaine as SocleConfig['ajoutes'][number]['domaine'], gravite, vraisemblance }] }))
    setNom('')
  }
  async function enregistrer() {
    setMsg(null)
    const res = await fetch('/api/admin/organization-config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ risquesProjetDefaut: cfg }) }).catch(() => null)
    setMsg(res?.ok ? r.saved : r.error)
  }

  return (
    <section className="card p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{r.title}</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{r.intro}</p>
        {moduleInactif && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{r.inactive}</p>}
        {!isAdmin && <p className="mt-1 text-xs text-gray-500">{r.readOnly}</p>}
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-gray-800 dark:text-gray-200">{r.catalogue}</legend>
        <ul className="space-y-1.5">
          {RISQUES_PROJET_SOCLE.map(x => (
            <li key={x.code}>
              <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input type="checkbox" className="mt-0.5" disabled={!isAdmin} checked={!cfg.desactives.includes(x.code)} onChange={() => toggle(x.code)} />
                <span>{x.intitule[i]} <span className="text-xs text-gray-400">· {domaines[x.domaine]}</span></span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-800 dark:text-gray-200">{r.ajoutes}</h3>
        {cfg.ajoutes.length === 0 ? <p className="text-xs italic text-gray-400">{r.aucun}</p> : (
          <ul className="mb-3 space-y-1">
            {cfg.ajoutes.map(a => (
              <li key={a.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <span className="flex-1">{a.intitule}</span>
                <span className="text-xs text-gray-400">{a.domaine ? domaines[a.domaine] : ''} · G{a.gravite} · V{a.vraisemblance}</span>
                {isAdmin && <button type="button" aria-label={`${r.remove} — ${a.intitule}`} onClick={() => setCfg(c => c && ({ ...c, ajoutes: c.ajoutes.filter(y => y.id !== a.id) }))} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} aria-hidden="true" /></button>}
              </li>
            ))}
          </ul>
        )}
        {isAdmin && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[14rem] text-xs text-gray-600 dark:text-gray-300">{r.intitule}
              <input aria-label={r.intitule} value={nom} maxLength={200} onChange={e => setNom(e.target.value)} className={`${field} mt-1 block w-full`} />
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{r.domaine}
              <select aria-label={r.domaine} value={domaine} onChange={e => setDomaine(e.target.value)} className={`${field} mt-1 block`}>
                {DOMAINES_360.map(d => <option key={d} value={d}>{domaines[d]}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{r.gravite}
              <select aria-label={r.gravite} value={gravite} onChange={e => setGravite(Number(e.target.value))} className={`${field} mt-1 block`}>
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-600 dark:text-gray-300">{r.vraisemblance}
              <select aria-label={r.vraisemblance} value={vraisemblance} onChange={e => setVraisemblance(Number(e.target.value))} className={`${field} mt-1 block`}>
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button type="button" onClick={ajouter} disabled={!nom.trim()} className="btn-secondary text-sm inline-flex items-center gap-1 disabled:opacity-50"><Plus size={14} aria-hidden="true" />{r.add}</button>
          </div>
        )}
      </div>
      {isAdmin && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={enregistrer} className="btn-primary text-sm">{r.save}</button>
          {msg && <span role="status" className="text-xs text-gray-600 dark:text-gray-300">{msg}</span>}
        </div>
      )}
    </section>
  )
}
