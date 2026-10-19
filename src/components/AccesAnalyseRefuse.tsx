'use client'

// ─── Accès non autorisé à une analyse (n° 63) ────────────────────────────────
// Affiché quand l'analyse existe dans l'organisation mais que la règle de visibilité
// (la même que la liste) ne l'ouvre pas au rôle : explication + « Demander l'accès ».
import { useState } from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

type Etat = 'idle' | 'envoi' | 'envoye' | 'enregistre' | 'erreur'

export default function AccesAnalyseRefuse({ analyseId, nom }: { analyseId: string; nom: string }) {
  const { t } = useTranslation()
  const [etat, setEtat] = useState<Etat>('idle')

  async function demander() {
    setEtat('envoi')
    try {
      const res = await fetch(`/api/analyses/${analyseId}/demande-acces`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setEtat('erreur'); return }
      setEtat(data.notifie ? 'envoye' : 'enregistre')
    } catch {
      setEtat('erreur')
    }
  }

  const fait = etat === 'envoye' || etat === 'enregistre'
  return (
    <div className="card max-w-xl mx-auto mt-12 p-6 text-center">
      <Lock className="mx-auto mb-3 text-gray-500" size={32} aria-hidden="true" />
      <h1 className="text-xl font-semibold mb-2">{t.access.accesRefuseTitre}</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-5">{t.access.accesRefuseTexte.replace('{nom}', nom)}</p>
      {etat === 'envoye' && <p role="status" className="text-green-700 dark:text-green-400 mb-4">{t.access.accesRefuseEnvoye}</p>}
      {etat === 'enregistre' && <p role="status" className="text-amber-700 dark:text-amber-400 mb-4">{t.access.accesRefuseEnregistre}</p>}
      {etat === 'erreur' && <p role="alert" className="text-red-700 dark:text-red-400 mb-4">{t.access.accesRefuseErreur}</p>}
      <div className="flex flex-wrap justify-center gap-3">
        {!fait && (
          <button type="button" className="btn-primary" onClick={demander} disabled={etat === 'envoi'}>
            {etat === 'envoi' ? t.access.accesRefuseEnvoi : t.access.accesRefuseDemander}
          </button>
        )}
        <Link href="/analyses" className="btn-secondary">{t.access.accesRefuseRetour}</Link>
      </div>
    </div>
  )
}
