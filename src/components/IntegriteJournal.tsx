'use client'
// Intégrité du journal d'audit (super-administrateur) : vérification de la chaîne d'empreintes à la demande.
// i18n ×5 (t.auditIntegrite). cf. lib/audit-chaine.
import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'

type Etat = { ok: boolean; verifiees: number; sansCle?: number; nonScellees: number; horsOrdre: number; rupture: { seq: string; raison: string } | null; dernier: { seq: string; createdAt: string } | null; cleConfiguree: boolean }

export default function IntegriteJournal() {
  const { t, locale } = useTranslation()
  const l = t.auditIntegrite
  const [etat, setEtat] = useState<Etat | null>(null)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState(false)

  async function verifier() {
    setBusy(true); setErreur(false)
    const r = await fetch('/api/admin/audit-log/integrite', { method: 'POST' }).catch(() => null)
    if (r?.ok) setEtat(await r.json()); else setErreur(true)
    setBusy(false)
  }
  return (
    <section aria-label={l.titre} className="card mb-6 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">{l.titre}</h2>
          <p className="text-gray-600 dark:text-gray-300">{l.aide}</p>
        </div>
        <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => void verifier()}>{busy ? l.enCours : l.verifier}</button>
      </div>
      {erreur && <p role="alert" className="mt-2 text-red-700 dark:text-red-300">{l.echec}</p>}
      {etat && (
        <div role="status" className="mt-3 space-y-1">
          <p className={etat.ok ? 'font-medium text-green-800 dark:text-green-300' : 'font-medium text-red-700 dark:text-red-300'}>
            {etat.ok ? l.integre.replace('{n}', etat.verifiees.toLocaleString(locale)) : l.rupture.replace('{seq}', etat.rupture!.seq).replace('{raison}', (l.raisons as Record<string, string>)[etat.rupture!.raison] ?? etat.rupture!.raison)}
          </p>
          {etat.dernier && <p className="text-gray-600 dark:text-gray-300">{l.dernier.replace('{seq}', etat.dernier.seq).replace('{date}', new Date(etat.dernier.createdAt).toLocaleString(locale))}</p>}
          {etat.nonScellees > 0 && <p className="text-gray-600 dark:text-gray-300">{l.nonScellees.replace('{n}', String(etat.nonScellees))}</p>}
          {etat.horsOrdre > 0 && <p className="text-amber-800 dark:text-amber-300">{l.horsOrdre.replace('{n}', String(etat.horsOrdre))}</p>}
          {etat.cleConfiguree && (etat.sansCle ?? 0) > 0 && <p className="text-amber-800 dark:text-amber-300">{l.sansCleEntrees.replace('{n}', String(etat.sansCle))}</p>}
          {!etat.cleConfiguree && <p className="text-amber-800 dark:text-amber-300">{l.sansCle}</p>}
        </div>
      )}
    </section>
  )
}
