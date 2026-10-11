'use client'

// ─── Sortir de la démarche Flash (recette n° 16) ─────────────────────────────
// La démarche Flash est mémorisée sur l'analyse : ce bouton du bandeau la désactive puis recharge l'atelier sans ?mode=flash.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'

export default function QuitterFlashButton({ analyseId, atelierNum }: { analyseId: string; atelierNum: number }) {
  const { t } = useTranslation()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function quitter() {
    setBusy(true)
    await fetch(`/api/analyses/${analyseId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ demarcheFlash: false }) }).catch(() => null)
    router.replace(`/analyses/${analyseId}/atelier/${atelierNum}`); router.refresh()
  }
  return (
    <button type="button" disabled={busy} onClick={() => void quitter()} className="text-xs font-semibold text-amber-800 underline hover:text-amber-950 whitespace-nowrap">
      {t.analyses.quitterFlash}
    </button>
  )
}
