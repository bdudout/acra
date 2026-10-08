'use client'

// ─── Signalement des erreurs serveur des appels d'API ─────────────────────────
// Observe les réponses des appels `fetch` vers les API d'ACRA (même origine, `/api/…`) : une réponse 5xx (erreur
// probablement due au code, pas à la saisie) affiche un bandeau proposant d'ouvrir une issue GitHub pré-remplie
// (lib/signalement-erreur : version installée, méthode et chemin anonymisés — jamais de données). Rien n'est envoyé
// par ACRA ; les réponses ne sont ni lues ni modifiées.
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { construireSignalement, urlNouvelleIssue } from '@/lib/signalement-erreur'

interface ErreurApi { statut: number; url: string; corps: string }

export default function SignalementErreursApi() {
  const { t } = useTranslation()
  const s = t.errorScreen.signaler
  const [erreur, setErreur] = useState<ErreurApi | null>(null)

  useEffect(() => {
    const original = window.fetch
    let actif = true
    let version: Promise<{ version?: string; revision?: string; issuesRepo?: string }> | null = null
    const lireVersion = () => (version ??= original('/api/health', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})))

    async function signaler(statut: number, methode: string, chemin: string) {
      const v = await lireVersion()
      if (!actif) return
      const sig = construireSignalement({
        version: v.version ?? 'inconnue', revision: v.revision ?? 'inconnue', statut, chemin: window.location.pathname,
        date: new Date(), userAgent: navigator.userAgent, langue: document.documentElement.lang || navigator.language, requete: { methode, chemin },
      })
      setErreur({ statut, url: urlNouvelleIssue(v.issuesRepo ?? '', sig.titre, sig.corps), corps: sig.corps })
    }

    const surveille: typeof window.fetch = async (input, init) => {
      const reponse = await original(input, init)
      try {
        const cible = new URL(input instanceof Request ? input.url : String(input), window.location.href)
        const methode = init?.method ?? (input instanceof Request ? input.method : 'GET')
        if (reponse.status >= 500 && cible.origin === window.location.origin && cible.pathname.startsWith('/api/') && cible.pathname !== '/api/health') {
          void signaler(reponse.status, methode, cible.pathname)
        }
      } catch { /* observation seulement : jamais d'effet sur l'appel */ }
      return reponse
    }
    window.fetch = surveille
    return () => { actif = false; if (window.fetch === surveille) window.fetch = original }
  }, [])

  if (!erreur) return null
  return (
    <div role="status" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-red-200 bg-white p-3 text-sm shadow-lg dark:border-red-500/30 dark:bg-gray-900 print:hidden">
      <div className="flex items-start gap-2">
        <p className="flex-1 text-gray-800 dark:text-gray-100">{s.toast.replace('{statut}', String(erreur.statut))}</p>
        <button type="button" onClick={() => setErreur(null)} aria-label={s.fermer} className="p-0.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"><X size={14} aria-hidden="true" /></button>
      </div>
      <a href={erreur.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-ebios-700 underline underline-offset-2 dark:text-ebios-300">{s.lien}</a>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{s.note}</p>
      <details className="mt-1 text-xs"><summary className="cursor-pointer text-gray-600 dark:text-gray-300">{s.apercu}</summary>
        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-sm bg-gray-50 p-2 text-gray-700 dark:bg-gray-800 dark:text-gray-200">{erreur.corps}</pre>
      </details>
    </div>
  )
}
