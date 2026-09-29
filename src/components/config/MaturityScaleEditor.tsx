'use client'

/**
 * MaturityScaleEditor — Échelle de maturité CMMI (niveaux 0 à 5) du module
 * Maturité, section « Échelles » de /configuration. Niveaux FIXES (les écarts se
 * calculent sur 0–5) ; seuls libellés et définitions sont personnalisables, par
 * l'ADMIN. Seuls les niveaux qui diffèrent du défaut (i18n) sont enregistrés :
 * les autres suivent la langue de l'utilisateur. Charge/sauve via
 * /api/admin/organization-config (champ echelleMaturite).
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { MATURITY_LEVELS, resolveMaturityScale, type MaturityScaleLevel } from '@/lib/maturity'

export default function MaturityScaleEditor({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation()
  const m = t.maturite
  const defaults = useMemo<MaturityScaleLevel[]>(() => {
    const levels = m.levels as Record<string, { libelle: string; definition: string }>
    return MATURITY_LEVELS.map(n => ({ niveau: n, libelle: levels[n].libelle, definition: levels[n].definition }))
  }, [m.levels])
  const [scale, setScale] = useState<MaturityScaleLevel[]>(defaults)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/organization-config')
      .then(r => r.json())
      .then(d => setScale(resolveMaturityScale(d?.echelleMaturite, defaults)))
      .catch(() => {})
  }, [defaults])

  function update(niveau: number, field: 'libelle' | 'definition', value: string) {
    setMessage(null)
    setScale(prev => prev.map(l => l.niveau === niveau ? { ...l, [field]: value } : l))
  }

  async function save(levels: MaturityScaleLevel[]) {
    setSaving(true); setMessage(null)
    // Seuls les écarts au défaut sont stockés ; un libellé vidé revient au défaut.
    const custom = levels
      .map(l => {
        const d = defaults[l.niveau]
        const libelle = l.libelle.trim() || d.libelle
        const definition = l.definition.trim() === d.definition ? '' : l.definition.trim()
        return libelle === d.libelle && !definition ? null : { niveau: l.niveau, libelle, definition }
      })
      .filter((l): l is MaturityScaleLevel => l !== null)
    try {
      const r = await fetch('/api/admin/organization-config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ echelleMaturite: custom }),
      })
      setMessage(r.ok ? m.scale.saved : m.saveError.replace('{error}', String(r.status)))
    } catch {
      setMessage(m.saveError.replace('{error}', '—'))
    } finally { setSaving(false) }
  }

  return (
    <section id="maturite-echelle" className="card p-5 mt-8 scroll-mt-24">
      <h2 className="text-base font-semibold text-gray-800">{m.scale.title}</h2>
      <p className="text-sm text-gray-500 mt-1">{m.scale.desc}</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="py-1 pr-3 w-16">{m.scale.level}</th>
              <th className="py-1 pr-3 w-64">{m.scale.label}</th>
              <th className="py-1">{m.scale.definition}</th>
            </tr>
          </thead>
          <tbody>
            {scale.map(l => (
              <tr key={l.niveau} className="border-t border-gray-100">
                <td className="py-2 pr-3 font-mono font-semibold text-ebios-700">{l.niveau}</td>
                <td className="py-2 pr-3">
                  <input aria-label={`${m.scale.level} ${l.niveau} — ${m.scale.label}`} value={l.libelle} readOnly={!isAdmin} maxLength={80}
                    onChange={e => update(l.niveau, 'libelle', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm read-only:bg-gray-50" />
                </td>
                <td className="py-2">
                  <input aria-label={`${m.scale.level} ${l.niveau} — ${m.scale.definition}`} value={l.definition} readOnly={!isAdmin} maxLength={500}
                    onChange={e => update(l.niveau, 'definition', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm read-only:bg-gray-50" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isAdmin && (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button type="button" disabled={saving} onClick={() => save(scale)} className="btn-primary text-sm disabled:opacity-50">{m.save}</button>
          <button type="button" disabled={saving} onClick={() => { setScale(defaults); save(defaults) }} className="btn-secondary text-sm disabled:opacity-50">{m.scale.reset}</button>
          {message && <span role="status" className="text-xs text-gray-600">{message}</span>}
        </div>
      )}
    </section>
  )
}
