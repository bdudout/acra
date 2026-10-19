'use client'
// Bandeau de récupération d'une saisie d'atelier non enregistrée (intégrité, 16/10/2026) : la saisie gardée
// dans le navigateur (lib/atelier-save) peut être renvoyée avec SA révision d'origine (un conflit est signalé,
// jamais écrasé), téléchargée, ou ignorée. i18n ×5 (t.brouillonAtelier).
import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { effacerBrouillon, lireBrouillon, renvoyerBrouillon, type BrouillonAtelier as Brouillon } from '@/lib/atelier-save'

export default function BrouillonAtelier({ analyseId, num }: { analyseId: string; num: number }) {
  const { t, locale } = useTranslation()
  const b = t.brouillonAtelier
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setBrouillon(lireBrouillon(analyseId, num)) }, [analyseId, num])
  if (!brouillon) return null

  async function renvoyer() {
    setBusy(true)
    const r = await renvoyerBrouillon(analyseId, num)
    setBusy(false)
    if (r === 'ok' || r === 'absent') { setMessage(b.renvoye); setTimeout(() => window.location.reload(), 800); return }
    setMessage(r === 'conflit' ? b.conflit : b.echec)
  }
  function telecharger() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(brouillon, null, 2)], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `acra-atelier-${num}-saisie-non-enregistree.json` })
    a.click(); URL.revokeObjectURL(url)
  }
  function ignorer() {
    if (!window.confirm(b.confirmerIgnorer)) return
    effacerBrouillon(analyseId, num); setBrouillon(null)
  }
  const btn = 'px-2 py-1 rounded-sm text-xs font-medium border'
  return (
    <div role="alert" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-500/15 dark:border-amber-500/40 p-3 shadow-lg text-sm text-amber-900 dark:text-amber-100">
      <p className="font-medium">{b.titre.replace('{date}', new Date(brouillon.date).toLocaleString(locale))}</p>
      <p className="mt-1 text-xs">{message ?? b.explication}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={renvoyer} className={`${btn} bg-amber-600 text-white border-amber-600 disabled:opacity-50`}>{b.renvoyer}</button>
        <button type="button" onClick={telecharger} className={`${btn} border-amber-400`}>{b.telecharger}</button>
        <button type="button" onClick={ignorer} className={`${btn} border-amber-400`}>{b.ignorer}</button>
      </div>
    </div>
  )
}
