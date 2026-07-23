'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { DEFAULT_TAXONOMIE_BALE, taxonomieLabel, type TaxonomieNode } from '@/lib/taxonomie'

/**
 * Éditeur de la taxonomie de risques (socle GRC). Vide ⇒ on matérialise le défaut
 * Bâle (7 catégories) pour édition. Enregistrer stocke la liste complète (override) ;
 * Réinitialiser stocke [] (retour au défaut). M0 : catégories de niveau 1.
 */
export default function TaxonomieEditor({ initial, disabled = false }: { initial: TaxonomieNode[]; disabled?: boolean }) {
  const { t } = useTranslation()
  const tr = (key: string) => key.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), t) ?? '' // eslint-disable-line @typescript-eslint/no-explicit-any

  // Matérialise le défaut Bâle (avec libellés i18n) si aucun override.
  const materializeDefaults = (): TaxonomieNode[] =>
    DEFAULT_TAXONOMIE_BALE.map(n => ({ ...n, label: taxonomieLabel(n, tr), labelKey: undefined }))

  const [rows, setRows] = useState<TaxonomieNode[]>(() => (initial.length > 0 ? initial : materializeDefaults()))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const nextCode = useMemo(() => {
    let i = rows.length + 1
    const used = new Set(rows.map(r => r.code))
    while (used.has(`CAT_${i}`)) i++
    return `CAT_${i}`
  }, [rows])

  function setLabel(code: string, label: string) {
    setRows(rs => rs.map(r => (r.code === code ? { ...r, label } : r)))
  }
  function remove(code: string) {
    setRows(rs => rs.filter(r => r.code !== code).map((r, i) => ({ ...r, ordre: i + 1 })))
  }
  function add() {
    setRows(rs => [...rs, { code: nextCode, label: '', domaine: 'OP_RISK', ordre: rs.length + 1, parent: null }])
  }
  function move(code: string, dir: -1 | 1) {
    setRows(rs => {
      const i = rs.findIndex(r => r.code === code)
      const j = i + dir
      if (i < 0 || j < 0 || j >= rs.length) return rs
      const copy = [...rs]; [copy[i], copy[j]] = [copy[j], copy[i]]
      return copy.map((r, k) => ({ ...r, ordre: k + 1 }))
    })
  }

  async function save(payload: TaxonomieNode[] | []) {
    setSaving(true); setSaved(false)
    const res = await fetch('/api/admin/organization-config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taxonomieRisques: payload }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
    if (payload.length === 0) setRows(materializeDefaults())
  }

  return (
    <div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.code} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-6 text-right">{i + 1}</span>
            <input
              value={r.label ?? ''}
              onChange={e => setLabel(r.code, e.target.value)}
              disabled={disabled}
              placeholder={t.taxonomie.categoryPlaceholder}
              className="flex-1 px-2 py-1.5 rounded border border-gray-300 text-sm"
            />
            <span className="text-[10px] font-mono text-gray-400 w-16 truncate" title={r.code}>{r.code}</span>
            {!disabled && (
              <>
                <button type="button" onClick={() => move(r.code, -1)} disabled={i === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1" aria-label="Monter">↑</button>
                <button type="button" onClick={() => move(r.code, 1)} disabled={i === rows.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1" aria-label="Descendre">↓</button>
                <button type="button" onClick={() => remove(r.code)} className="text-red-400 hover:text-red-600 px-1" aria-label="Supprimer">✕</button>
              </>
            )}
          </div>
        ))}
      </div>
      {!disabled && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button type="button" onClick={add} className="text-sm text-ebios-600 hover:text-ebios-800 font-medium">+ {t.taxonomie.addCategory}</button>
          <div className="flex-1" />
          <button type="button" onClick={() => save([])} disabled={saving} className="btn-secondary text-sm">{t.taxonomie.resetDefault}</button>
          <button type="button" onClick={() => save(rows.filter(r => (r.label ?? '').trim()))} disabled={saving} className="btn-primary text-sm">
            {saved ? t.config.savedLabel : t.config.saveShort}
          </button>
        </div>
      )}
    </div>
  )
}
