'use client'

// ─── Fiche d'information d'un régime de déclaration : base légale, destinataire, déclencheur, délais, canal ─────────────────
// Repliée par défaut. Informations de cadrage tirées des textes publiés (lib/regime-info.ts) : ce n'est pas un avis juridique.

import { useTranslation } from '@/lib/i18n/context'
import { regimeInfo, type InfoLocale } from '@/lib/regime-info'

export default function RegimeInfoBlock({ code }: { code: string }) {
  const { t, locale } = useTranslation()
  const c = t.incidents.regimeInfo
  const info = regimeInfo(code, (['fr', 'en', 'de', 'es', 'it'].includes(locale) ? locale : 'fr') as InfoLocale)
  if (!info) return null
  const row = (label: string, text?: string) => text ? <div><dt className="font-medium text-gray-700 dark:text-gray-200">{label}</dt><dd className="mt-0.5 text-gray-600 dark:text-gray-300">{text}</dd></div> : null
  return (
    <details className="mt-1 rounded border border-gray-100 dark:border-gray-700 px-2 py-1 text-[11px]">
      <summary className="cursor-pointer text-ebios-700 dark:text-ebios-300">{c.toggle}</summary>
      <dl className="mt-1 space-y-1.5">
        {row(c.basis, info.basis)}{row(c.recipient, info.recipient)}{row(c.trigger, info.trigger)}{row(c.deadlines, info.deadlines)}{row(c.channel, info.channel)}{row(c.notes, info.notes)}
        {info.sources.length > 0 && (
          <div><dt className="font-medium text-gray-700 dark:text-gray-200">{c.sources}</dt>
            <dd className="mt-0.5 space-y-0.5">{info.sources.map(u => <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="block break-all text-ebios-700 underline dark:text-ebios-300">{u}</a>)}</dd></div>
        )}
      </dl>
      <p className="mt-1 text-gray-400">{c.disclaimer}</p>
    </details>
  )
}
