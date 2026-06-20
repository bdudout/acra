'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Afficher seulement si l'utilisateur n'a pas déjà fermé le bandeau
    const ack = localStorage.getItem('acra-cookie-ack')
    if (!ack) setVisible(true)
  }, [])

  // Réserve EXACTEMENT la hauteur réelle du bandeau (qui varie selon le viewport,
  // 1 à 3 lignes) pour ne jamais recouvrir le bas de page (UX #5).
  useEffect(() => {
    const el = ref.current
    if (!visible || !el) { document.body.style.paddingBottom = ''; return }
    const apply = () => { document.body.style.paddingBottom = `${el.offsetHeight}px` }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => { ro.disconnect(); document.body.style.paddingBottom = '' }
  }, [visible])

  function dismiss() {
    localStorage.setItem('acra-cookie-ack', '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div ref={ref} className="fixed bottom-0 inset-x-0 z-50 bg-gray-900 text-white shadow-2xl" role="region" aria-label="Information sur les cookies">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <span className="text-lg flex-shrink-0" aria-hidden="true">🍪</span>
        <p className="text-sm flex-1 text-gray-200">
          ACRA utilise uniquement des cookies <strong className="text-white">strictement nécessaires</strong> à son
          fonctionnement&nbsp;: authentification (session sécurisée) et préférence de langue.
          Aucun cookie publicitaire ou de tracking n'est utilisé.{' '}
          <Link href="/legal/privacy" className="text-ebios-300 hover:text-ebios-200 underline">
            En savoir plus
          </Link>
        </p>
        <button
          onClick={dismiss}
          className="flex-shrink-0 px-4 py-1.5 bg-ebios-600 hover:bg-ebios-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Compris
        </button>
      </div>
    </div>
  )
}
