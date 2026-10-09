'use client'

// ─── Page RGPD : registre du responsable et, en option, du sous-traitant ──────
// Onglets affichés seulement si le registre du sous-traitant (art. 30 §2) est activé pour l'organisation ; sinon, une
// ligne explique comment l'obtenir.
import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'
import RopaManager from '@/components/RopaManager'
import RopaSousTraitanceManager from '@/components/RopaSousTraitanceManager'

export default function RgpdOnglets({ sousTraitant, estAdmin = false }: { sousTraitant: boolean; estAdmin?: boolean }) {
  const { t } = useTranslation()
  const r = t.ropa.sousTraitance
  const [onglet, setOnglet] = useState<'responsable' | 'sousTraitant'>('responsable')
  // Module désactivé : une ligne dit qu'il existe et qui peut l'activer (l'administrateur, dans Configuration › Fonctionnalités).
  if (!sousTraitant) return (
    <div>
      <RopaManager />
      <p className="mt-6 text-xs text-gray-500 dark:text-gray-400">
        {r.inactif}{' '}
        {estAdmin && <Link href="/configuration" className="text-ebios-700 dark:text-ebios-300 underline">{r.activer}</Link>}
      </p>
    </div>
  )
  return (
    <div>
      <div role="tablist" aria-label={t.ropa.title} className="flex flex-wrap gap-1.5 border-b border-gray-200 dark:border-gray-700 mb-5">
        {(['responsable', 'sousTraitant'] as const).map(o => (
          <button key={o} type="button" role="tab" aria-selected={onglet === o} onClick={() => setOnglet(o)}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${onglet === o ? 'border-ebios-600 text-ebios-700 dark:text-ebios-300 font-medium' : 'border-transparent text-gray-500'}`}>
            {o === 'responsable' ? r.ongletResponsable : r.ongletSousTraitant}
          </button>
        ))}
      </div>
      {onglet === 'responsable' ? <RopaManager /> : <RopaSousTraitanceManager />}
    </div>
  )
}
