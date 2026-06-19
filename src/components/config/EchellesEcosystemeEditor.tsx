'use client'

/**
 * EchellesEcosystemeEditor — Éditeur des 4 échelles de cotation de la dangerosité
 * des parties prenantes (atelier 3), section « Écosystème » de /configuration.
 *
 * Chaque critère (dépendance, pénétration, maturité, confiance) est une échelle
 * qualitative ordonnée dont chaque niveau porte un nom (+ description). ADMIN only.
 * Charge/sauve via /api/admin/organization-config (champ echellesEcosysteme).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import {
  CRITERES_ECOSYSTEME,
  resolveEchelles,
  type CritereEcosysteme,
  type EchellesEcosysteme,
  type NiveauEchelle,
} from '@/lib/ecosystem-echelles'

export default function EchellesEcosystemeEditor({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation()
  const c = t.config
  const a3 = t.workshop.a3
  const critereLabel: Record<CritereEcosysteme, string> = {
    dependance: a3.ppDependanceLabel,
    penetration: a3.ppPenetrationLabel,
    maturite: a3.ppMaturiteLabel,
    confiance: a3.ppConfianceLabel,
  }

  const [echelles, setEchelles] = useState<EchellesEcosysteme>(() => resolveEchelles(null))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/admin/organization-config')
      .then(r => r.json())
      .then(d => setEchelles(resolveEchelles(d?.echellesEcosysteme)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function setNiveaux(crit: CritereEcosysteme, niveaux: NiveauEchelle[]) {
    setEchelles(prev => ({ ...prev, [crit]: { niveaux } }))
    setSaved(false)
  }
  function updateNiveau(crit: CritereEcosysteme, idx: number, field: 'nom' | 'description', value: string) {
    setNiveaux(crit, echelles[crit].niveaux.map((n, i) => i === idx ? { ...n, [field]: value } : n))
  }
  function addNiveau(crit: CritereEcosysteme) {
    const niveaux = echelles[crit].niveaux
    setNiveaux(crit, [...niveaux, { valeur: niveaux.length + 1, nom: '' }])
  }
  function removeNiveau(crit: CritereEcosysteme, idx: number) {
    const niveaux = echelles[crit].niveaux.filter((_, i) => i !== idx).map((n, i) => ({ ...n, valeur: i + 1 }))
    setNiveaux(crit, niveaux)
  }

  async function save() {
    setSaving(true); setSaved(false)
    const res = await fetch('/api/admin/organization-config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ echellesEcosysteme: echelles }),
    })
    setSaving(false)
    if (res.ok) {
      const d = await res.json()
      setEchelles(resolveEchelles(d?.echellesEcosysteme))
      setSaved(true)
    }
  }
  async function reset() {
    setSaving(true); setSaved(false)
    const res = await fetch('/api/admin/organization-config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ echellesEcosysteme: {} }),
    })
    setSaving(false)
    if (res.ok) { setEchelles(resolveEchelles(null)); setSaved(true) }
  }

  if (loading) return <p className="text-sm text-gray-500">…</p>

  return (
    <section className="card p-6">
      <h2 className="font-semibold text-gray-800 mb-1">{c.ecoScalesTitle}</h2>
      <p className="text-sm text-gray-500 mb-5">{c.ecoScalesDesc}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {CRITERES_ECOSYSTEME.map(crit => (
          <div key={crit} className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 text-sm mb-3">{critereLabel[crit]}</h3>
            <div className="space-y-2">
              {echelles[crit].niveaux.map((n, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <span className="mt-2 w-6 shrink-0 text-center text-xs font-bold text-gray-400">{n.valeur}</span>
                  <div className="flex-1 space-y-1">
                    <input
                      value={n.nom}
                      onChange={e => updateNiveau(crit, idx, 'nom', e.target.value)}
                      disabled={!isAdmin}
                      placeholder={c.ecoLevelName}
                      className="input text-sm w-full"
                    />
                    <input
                      value={n.description ?? ''}
                      onChange={e => updateNiveau(crit, idx, 'description', e.target.value)}
                      disabled={!isAdmin}
                      placeholder={c.ecoLevelDesc}
                      className="input text-xs w-full text-gray-600"
                    />
                  </div>
                  {isAdmin && echelles[crit].niveaux.length > 2 && (
                    <button aria-label={c.ecoRemoveLevel} onClick={() => removeNiveau(crit, idx)}
                      className="mt-1.5 text-gray-400 hover:text-red-500"><span aria-hidden="true">✕</span></button>
                  )}
                </div>
              ))}
            </div>
            {isAdmin && echelles[crit].niveaux.length < 10 && (
              <button onClick={() => addNiveau(crit)} className="mt-3 text-xs text-blue-600 hover:text-blue-800 underline">
                {c.ecoAddLevel}
              </button>
            )}
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="mt-5 flex items-center gap-3">
          <button onClick={save} disabled={saving} className="btn-primary text-sm">
            {saving ? t.saving : t.save}
          </button>
          <button onClick={reset} disabled={saving} className="text-xs text-gray-500 hover:text-gray-700 underline">
            {c.ecoResetDefaults}
          </button>
          {saved && <span className="text-sm text-green-600">{c.savedMsg}</span>}
        </div>
      )}
    </section>
  )
}
