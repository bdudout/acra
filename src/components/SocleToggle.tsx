'use client'

/**
 * SocleToggle — bouton pour marquer/démarquer une analyse comme "analyse socle".
 *
 * Une analyse socle sert de référence partagée : ses valeurs métier, biens
 * supports et sources de risque sont copiés lors de la création d'analyses
 * héritières.
 *
 * Visible uniquement pour le propriétaire de l'analyse ou un ADMIN.
 * Effectue un PATCH /api/analyses/[id] avec { isSocle: boolean }.
 *
 * Props:
 *  - analyseId : identifiant Prisma de l'analyse
 *  - isSocle   : état courant
 *  - heritiersCount : nombre d'analyses qui héritent de ce socle
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  analyseId: string
  isSocle: boolean
  heritiersCount?: number
}

export default function SocleToggle({ analyseId, isSocle, heritiersCount = 0 }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function toggle() {
    setLoading(true)
    await fetch(`/api/analyses/${analyseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSocle: !isSocle }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl">
      <div className="flex-1">
        <p className="text-sm font-semibold text-purple-900">
          {isSocle ? '🏛️ Analyse socle active' : '🏛️ Marquer comme analyse socle'}
        </p>
        <p className="text-xs text-purple-700 mt-0.5">
          {isSocle
            ? `Cette analyse est utilisée comme socle de référence${heritiersCount > 0 ? ` par ${heritiersCount} analyse(s) héritière(s)` : ''}.`
            : `Permettre à d'autres analyses d'hériter des valeurs métier, biens supports et sources de risque de cette analyse.`}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={loading}
        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
          isSocle
            ? 'bg-purple-200 text-purple-800 hover:bg-purple-300'
            : 'bg-purple-600 text-white hover:bg-purple-700'
        }`}
      >
        {loading ? '…' : isSocle ? 'Désactiver' : 'Activer'}
      </button>
    </div>
  )
}
