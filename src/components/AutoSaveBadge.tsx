'use client'

/**
 * AutoSaveBadge — Indicateur de statut de l'auto-sauvegarde
 *
 * Affiche une pastille discrète en haut à droite de l'atelier :
 *   ⏳ En attente…    (pending)
 *   💾 Sauvegarde…   (saving)
 *   ✓  Sauvegardé    (saved)
 *   ⚠  Erreur        (error)
 *
 * Usage :
 *   <AutoSaveBadge status={status} lastSaved={lastSaved} error={error} />
 */

import type { AutoSaveStatus } from '@/lib/useAutoSave'

interface AutoSaveBadgeProps {
  status: AutoSaveStatus
  lastSaved: Date | null
  error: string | null
  className?: string
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function AutoSaveBadge({ status, lastSaved, error, className = '' }: AutoSaveBadgeProps) {
  if (status === 'idle' && !lastSaved) return null

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition-all duration-300 ${className} ${
        status === 'error'
          ? 'bg-red-50 text-red-600 border border-red-200'
          : status === 'saved'
          ? 'bg-green-50 text-green-700 border border-green-200'
          : status === 'saving' || status === 'pending'
          ? 'bg-blue-50 text-blue-600 border border-blue-200'
          : 'bg-gray-50 text-gray-500 border border-gray-200'
      }`}
      role="status"
      aria-live="polite"
      aria-label={
        status === 'error'
          ? `Erreur de sauvegarde : ${error ?? 'inconnue'}`
          : status === 'saved'
          ? `Sauvegardé à ${lastSaved ? formatTime(lastSaved) : ''}`
          : status === 'saving'
          ? 'Sauvegarde en cours…'
          : status === 'pending'
          ? 'Modifications non sauvegardées…'
          : `Dernière sauvegarde : ${lastSaved ? formatTime(lastSaved) : ''}`
      }
    >
      {status === 'pending' && (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" aria-hidden="true" />
          <span>Non sauvegardé…</span>
        </>
      )}
      {status === 'saving' && (
        <>
          <svg className="w-3 h-3 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
          <span>Sauvegarde…</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <svg className="w-3 h-3 text-green-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span>Sauvegardé {lastSaved ? `à ${formatTime(lastSaved)}` : ''}</span>
        </>
      )}
      {status === 'error' && (
        <>
          <svg className="w-3 h-3 text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>Erreur de sauvegarde</span>
        </>
      )}
      {status === 'idle' && lastSaved && (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" aria-hidden="true" />
          <span>{formatTime(lastSaved)}</span>
        </>
      )}
    </div>
  )
}
