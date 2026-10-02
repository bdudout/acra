'use client'

// ─── Guide « petite structure » (Utilisateurs et droits) ─────────────────────
// Explique le cumul des rôles RSSI / gestionnaire des risques / analyste (et RSSI pour
// l'administrateur) quand une seule personne porte la sécurité et les risques, ce qui reste
// séparé, la traçabilité, et l'état du réglage pour l'organisation active.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, MinusCircle, Users } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

export default function PetiteStructureGuide() {
  const { t } = useTranslation()
  const g = t.admin.petiteStructure
  const [actif, setActif] = useState<boolean | null>(null)
  useEffect(() => {
    void fetch('/api/admin/organization-config').then(async r => (r.ok ? setActif(Boolean((await r.json()).petiteStructure)) : setActif(null))).catch(() => setActif(null))
  }, [])
  return <section className="mt-6 card p-5" aria-labelledby="petite-structure-titre" data-testid="petite-structure-guide">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h2 id="petite-structure-titre" className="font-semibold text-gray-800 dark:text-gray-100"><Users size={18} className="inline align-[-0.2em] mr-1.5" aria-hidden="true" />{g.titre}</h2>
      {actif !== null && <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${actif ? 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{actif ? g.actif : g.inactif}</span>}
    </div>
    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{g.intro}</p>
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <h3 className="mb-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">{g.peutTitre}</h3>
        <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
          {g.peut.map(x => <li key={x} className="flex gap-1.5"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-green-600" aria-hidden="true" />{x}</li>)}
        </ul>
      </div>
      <div>
        <h3 className="mb-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">{g.resteTitre}</h3>
        <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
          {g.reste.map(x => <li key={x} className="flex gap-1.5"><MinusCircle size={15} className="mt-0.5 shrink-0 text-gray-500" aria-hidden="true" />{x}</li>)}
        </ul>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{g.trace}</p>
      </div>
    </div>
    <p className="mt-4 flex gap-1.5 rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"><AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />{g.attention}</p>
    <p className="mt-3"><Link href="/configuration" className="text-sm font-medium text-ebios-700 hover:underline">{g.configurer} →</Link></p>
  </section>
}
