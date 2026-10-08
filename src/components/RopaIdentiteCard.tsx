'use client'

// ─── Registre des traitements : identité du responsable (RGPD art. 30 §1 a) ───
// Responsable du traitement, représentant (art. 27) et délégué à la protection des données. Le DPO désigné dans ACRA
// (rôle DPO) est repris automatiquement ; sinon, saisie libre. API : /api/ropa/identite.
import { useEffect, useState } from 'react'
import { Building2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import type { IdentiteEffective, IdentiteSaisie, Personne } from '@/lib/ropa-identite'

interface Donnees { saisie: IdentiteSaisie; designes: Personne[]; effective: IdentiteEffective }

export default function RopaIdentiteCard() {
  const { t } = useTranslation()
  const r = t.ropa.identite
  const [data, setData] = useState<Donnees | null>(null)
  const [form, setForm] = useState<IdentiteSaisie | null>(null)
  const [statut, setStatut] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/ropa/identite').then(x => (x.ok ? x.json() : null)).then((d: Donnees | null) => { if (d) { setData(d); setForm(d.saisie) } }).catch(() => {})
  }, [])

  async function enregistrer() {
    if (!form) return
    setStatut(null)
    const res = await fetch('/api/ropa/identite', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }).catch(() => null)
    if (!res?.ok) { setStatut(t.ropa.err_generic); return }
    const d = (await res.json()) as Donnees
    setData(d); setForm(d.saisie); setStatut(r.enregistre)
  }

  if (!data || !form) return null
  const champ = 'mt-1 block w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-900 dark:border-gray-600'
  const label = 'text-xs text-gray-500 dark:text-gray-400'
  const saisir = (k: keyof IdentiteSaisie, libelle: string) => (
    <label className={label}>{libelle}<input aria-label={libelle} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} className={champ} /></label>
  )

  return (
    <section className="card p-4 mb-6 space-y-3" aria-labelledby="ropa-identite-titre">
      <div>
        <h2 id="ropa-identite-titre" className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2"><Building2 size={16} aria-hidden="true" />{r.titre}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.aide}</p>
      </div>
      {data.effective.manquants.length > 0 && <p role="status" className="text-xs rounded-sm bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200 px-2 py-1.5">{r.manque}</p>}
      <div className="grid md:grid-cols-3 gap-3">
        {saisir('responsableNom', r.responsable)}
        {saisir('responsableAdresse', r.adresse)}
        {saisir('responsableContact', r.contact)}
        {saisir('representantNom', r.representant)}
        {saisir('representantContact', r.representantContact)}
      </div>
      {/* DPO désigné dans ACRA : repris automatiquement ; sinon saisie libre. */}
      {data.designes.length > 0
        ? <p className="text-sm text-gray-700 dark:text-gray-200">{r.dpoDesigne.replace('{noms}', data.designes.map(d => `${d.nom} (${d.contact})`).join(', '))}</p>
        : <div className="space-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">{r.dpoLibre}</p>
            <div className="grid md:grid-cols-2 gap-3">{saisir('dpoNom', r.dpo)}{saisir('dpoContact', r.dpoContact)}</div>
          </div>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={enregistrer} className="btn-secondary text-sm">{r.enregistrer}</button>
        {statut && <span role="status" className="text-xs text-gray-600 dark:text-gray-300">{statut}</span>}
      </div>
    </section>
  )
}
