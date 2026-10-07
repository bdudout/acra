'use client'

// ─── Configuration « Planification » (programme d'audit et de contrôle) ───────
// Réglée par l'administrateur de l'organisation : mode par défaut des plans (figé : client final ; dynamique : cabinet
// d'audit), double regard (désactivé par défaut), seuil des angles morts, préparateurs et validateurs par type de plan.
// Stockée dans OrganizationConfig.planificationConfig (assainie côté serveur, lib/planification).
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { DEFAULT_PLANIFICATION, sanitizePlanificationConfig, type PlanificationConfig, type TypePlan } from '@/lib/planification'
import type { UserRole } from '@/lib/permissions'

const ROLES_PROPOSES: UserRole[] = ['ADMIN', 'RSSI', 'RISK_MANAGER', 'DIRECTION_METIER', 'AUDITEUR', 'CONTROLEUR', 'CONFORMITE', 'DPO']

export default function PlanificationSettings() {
  const { t } = useTranslation()
  const p = t.planification
  const [cfg, setCfg] = useState<PlanificationConfig>(DEFAULT_PLANIFICATION)
  const [etat, setEtat] = useState<'charge' | 'pret' | 'ok' | 'erreur'>('charge')

  useEffect(() => {
    fetch('/api/admin/organization-config').then(r => (r.ok ? r.json() : null)).then(d => {
      if (d) setCfg(sanitizePlanificationConfig(d.planificationConfig))
      setEtat('pret')
    }).catch(() => setEtat('pret'))
  }, [])

  const basculerRole = (type: TypePlan, liste: 'preparateurs' | 'validateurs', role: UserRole) => setCfg(c => {
    const actuels = c[type][liste]
    const suivants = actuels.includes(role) ? actuels.filter(r => r !== role) : [...actuels, role]
    return { ...c, [type]: { ...c[type], [liste]: suivants.length ? suivants : actuels } }
  })

  async function enregistrer() {
    const r = await fetch('/api/admin/organization-config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planificationConfig: cfg }) }).catch(() => null)
    setEtat(r?.ok ? 'ok' : 'erreur')
  }

  if (etat === 'charge') return <p className="text-sm text-gray-400">…</p>
  const champ = 'mt-1 block rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600'
  const typeLabel: Record<TypePlan, string> = { AUDIT: p.planAudit, CONTROLE: p.planControle }
  const listeLabel = { preparateurs: p.preparateurs, validateurs: p.validateurs }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-6 items-end">
        <label className="text-sm text-gray-700 dark:text-gray-200">{p.modeDefaut}
          <select aria-label={p.modeDefaut} value={cfg.modeDefaut} onChange={e => setCfg(c => ({ ...c, modeDefaut: e.target.value as PlanificationConfig['modeDefaut'] }))} className={champ}>
            <option value="FIGE">{p.modes.FIGE}</option>
            <option value="DYNAMIQUE">{p.modes.DYNAMIQUE}</option>
          </select>
        </label>
        <label className="text-sm text-gray-700 dark:text-gray-200">{p.seuilAnglesMorts}
          <input type="number" min={1} max={10} value={cfg.seuilAnglesMortsAns} onChange={e => setCfg(c => ({ ...c, seuilAnglesMortsAns: Number(e.target.value) || 3 }))} className={`${champ} w-24`} />
        </label>
        <div className="flex items-center gap-2">
          <button type="button" role="switch" aria-checked={cfg.doubleRegard} aria-label={p.doubleRegard}
            onClick={() => setCfg(c => ({ ...c, doubleRegard: !c.doubleRegard }))}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${cfg.doubleRegard ? 'bg-ebios-600' : 'bg-gray-500 dark:bg-gray-400'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cfg.doubleRegard ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className="text-sm text-gray-700 dark:text-gray-200">{p.doubleRegard}</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{p.modesAide}</p>
      {(['AUDIT', 'CONTROLE'] as const).map(type => (
        <fieldset key={type} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <legend className="px-1 text-sm font-medium text-gray-800 dark:text-gray-100">{typeLabel[type]}</legend>
          {(['preparateurs', 'validateurs'] as const).map(liste => (
            <div key={liste} className="mt-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">{listeLabel[liste]}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                {ROLES_PROPOSES.map(role => (
                  <label key={role} className="text-xs text-gray-700 dark:text-gray-200 inline-flex items-center gap-1.5">
                    <input type="checkbox" checked={cfg[type][liste].includes(role)} onChange={() => basculerRole(type, liste, role)}
                      aria-label={`${typeLabel[type]} — ${listeLabel[liste].toLowerCase()} : ${t.roles[role] ?? role}`} />
                    {t.roles[role] ?? role}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      ))}
      <div className="flex items-center gap-3">
        <button type="button" onClick={enregistrer} className="btn-primary text-sm">{p.enregistrer}</button>
        {etat === 'ok' && <span role="status" className="text-xs text-green-700 dark:text-green-400">{t.config.savedLabel}</span>}
        {etat === 'erreur' && <span role="alert" className="text-xs text-red-600">{p.erreur}</span>}
      </div>
    </div>
  )
}
