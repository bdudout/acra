'use client'

// ─── Menu déroulant accessible (clavier + lecteur d'écran) ────────────────────
// Motif WAI-ARIA « menu button » : ↓/↑ sur le bouton ouvrent sur le premier/dernier élément ; ↓ ↑ Début Fin circulent (avec
// retour) ; Échap ferme et rend le focus au bouton ; Tab ferme sans piéger le focus ; clic extérieur ferme. Les éléments
// `aria-disabled="true"` sont annoncés mais sautés. Partagé par « Nouvelle analyse » et « Importer ».

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

export function useDropdownMenu(defaultOpen = false) {
  const [open, setOpen] = useState(defaultOpen)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pendingFocus = useRef<'first' | 'last' | null>(null)
  const uid = useId()
  const triggerId = `${uid}-trigger`
  const menuId = `${uid}-menu`

  const items = useCallback(() => Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []), [])
  const close = useCallback((refocus: boolean) => { setOpen(false); if (refocus) triggerRef.current?.focus() }, [])

  // Focus initial après ouverture au clavier.
  useEffect(() => {
    if (!open || !pendingFocus.current) return
    const list = items(); const target = pendingFocus.current === 'first' ? list[0] : list[list.length - 1]
    pendingFocus.current = null; target?.focus()
  }, [open, items])

  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(true); return }
      if (e.key === 'Tab') { close(false); return }
      const list = items(); if (list.length === 0) return
      const index = list.indexOf(document.activeElement as HTMLElement)
      let next: number | null = null
      if (e.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % list.length
      else if (e.key === 'ArrowUp') next = index < 0 ? list.length - 1 : (index - 1 + list.length) % list.length
      else if (e.key === 'Home') next = 0
      else if (e.key === 'End') next = list.length - 1
      if (next !== null) { e.preventDefault(); list[next].focus() }
    }
    const onClick = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [open, close, items])

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); pendingFocus.current = 'first'; setOpen(true) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); pendingFocus.current = 'last'; setOpen(true) }
  }

  return {
    open, setOpen, close, rootRef,
    triggerProps: { id: triggerId, ref: triggerRef, 'aria-haspopup': 'menu' as const, 'aria-expanded': open, 'aria-controls': open ? menuId : undefined, onKeyDown: onTriggerKeyDown, onClick: () => setOpen(o => !o) },
    menuProps: { id: menuId, role: 'menu' as const, 'aria-labelledby': triggerId },
  }
}
