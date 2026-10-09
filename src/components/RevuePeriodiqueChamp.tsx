'use client'

// ─── Champ « dernière revue » (revues périodiques) ────────────────────────────
// Traitements RGPD, processus (BIA), tiers : date de dernière revue (pas de date future) et prochaine échéance, 12 mois
// après la dernière revue ou après la création (lib/revues) ; le cron `relances` relance à l'approche puis au retard.
import { useTranslation } from '@/lib/i18n/context'
import { echeanceRevue } from '@/lib/revues'

export default function RevuePeriodiqueChamp({ valeur, creeLe, onChange, now = new Date(), className }: {
  valeur: string; creeLe?: string | null; onChange: (v: string) => void; now?: Date; className?: string
}) {
  const { t, locale } = useTranslation()
  const r = t.revues
  const derniere = valeur ? new Date(`${valeur}T00:00:00Z`) : null
  const prochaine = derniere || creeLe ? echeanceRevue(derniere, new Date(creeLe ?? valeur)) : null
  const enRetard = !!prochaine && prochaine.getTime() < now.getTime()
  return (
    <div className={className}>
      <label className="text-xs text-gray-500">{r.derniereRevue}
        <input type="date" aria-label={r.derniereRevue} value={valeur} max={now.toISOString().slice(0, 10)} onChange={e => onChange(e.target.value)}
          className="mt-1 block w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-900 dark:border-gray-600" />
      </label>
      {prochaine && (
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          {r.prochaineRevue.replace('{date}', prochaine.toLocaleDateString(locale, { timeZone: 'UTC' }))}
          {enRetard && <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700 dark:bg-red-500/20 dark:text-red-300">{r.enRetard}</span>}
        </p>
      )}
    </div>
  )
}
