'use client'

/**
 * OrgSwitcher — Sélecteur d'organisation active (multi-organisation).
 * N'apparaît que si l'utilisateur a accès à plusieurs organisations.
 * Bascule via POST /api/org/active (cookie acra_org) puis rafraîchit la vue.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'

interface OrgOption { id: string; nom: string }

export default function OrgSwitcher() {
  const { t } = useTranslation()
  const router = useRouter()
  const [options, setOptions] = useState<OrgOption[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/org/active', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) { setOptions(d.options ?? []); setActiveId(d.activeOrgId ?? null) } })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Masqué tant qu'il n'y a qu'une seule organisation accessible.
  if (options.length < 2) return null

  const active = options.find(o => o.id === activeId) ?? options[0]

  async function choose(id: string) {
    if (id === activeId) { setOpen(false); return }
    setBusy(true)
    try {
      const res = await fetch('/api/org/active', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgId: id }),
      })
      if (res.ok) { setActiveId(id); setOpen(false); router.refresh() }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={busy}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t.nav.organization}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M3 5a1 1 0 011-1h12a1 1 0 011 1v2H3V5zm0 4h14v6a1 1 0 01-1 1H4a1 1 0 01-1-1V9zm3 2a1 1 0 100 2h2a1 1 0 100-2H6z" />
        </svg>
        <span className="max-w-[140px] truncate font-medium">{active?.nom}</span>
        <svg className="h-3.5 w-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div role="listbox" className="absolute right-0 z-50 mt-1 max-h-72 w-64 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t.nav.organization}</div>
          {options.map(o => (
            <button
              key={o.id}
              role="option"
              aria-selected={o.id === active?.id}
              onClick={() => choose(o.id)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${o.id === active?.id ? 'font-semibold text-ebios-700 dark:text-ebios-300' : 'text-gray-700 dark:text-gray-200'}`}
            >
              <span className="truncate">{o.nom}</span>
              {o.id === active?.id && (
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.79 6.8-6.79a1 1 0 011.4 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
