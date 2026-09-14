'use client'

// Carte « Version & mises à jour » (SUPER_ADMIN, tableau de bord admin). Compare
// la version installée à la dernière release GitHub et signale une mise à jour
// disponible — sans l'installer (déploiement manuel/CI). Cf. /api/admin/version.

import { useEffect, useState } from 'react'
import { RefreshCw, CheckCircle2, ArrowUpCircle, AlertTriangle } from 'lucide-react'

interface VersionInfo {
  current: string
  latest: string | null
  latestName: string | null
  releaseUrl: string | null
  publishedAt: string | null
  updateAvailable: boolean
  reachable: boolean
  repo: string
}

export default function VersionCard() {
  const [info, setInfo] = useState<VersionInfo | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/version')
      setInfo(r.ok ? await r.json() : null)
    } catch { setInfo(null) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  return (
    <div className="card p-5 mb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-0.5">Version &amp; mises à jour</h2>
          <p className="text-sm text-gray-500">
            Version installée : <span className="font-mono font-medium text-gray-800">{info?.current ?? '—'}</span>
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Vérifier
        </button>
      </div>

      <div className="mt-3 text-sm">
        {loading ? (
          <span className="text-gray-400">Vérification…</span>
        ) : !info || !info.reachable ? (
          <span className="inline-flex items-center gap-1.5 text-amber-700">
            <AlertTriangle size={15} aria-hidden="true" /> Vérification indisponible (GitHub injoignable).
          </span>
        ) : info.updateAvailable ? (
          <div className="rounded-lg border border-ebios-200 bg-ebios-50 px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-ebios-800 font-medium">
              <ArrowUpCircle size={16} aria-hidden="true" /> Mise à jour disponible : {info.latest}
            </span>
            {info.releaseUrl && (
              <a href={info.releaseUrl} target="_blank" rel="noopener noreferrer" className="text-ebios-700 hover:underline text-sm font-medium">
                Voir les notes de version →
              </a>
            )}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-green-700">
            <CheckCircle2 size={15} aria-hidden="true" /> Application à jour{info.latest ? ` (dernière release ${info.latest})` : ''}.
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-400 mt-2">
        La mise à jour n&apos;est pas installée automatiquement : elle se déploie via la procédure de déploiement (CI / serveur).
      </p>
    </div>
  )
}
