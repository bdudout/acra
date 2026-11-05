'use client'

// ─── Stratégies cyber / IT / résilience : liste et création (lot S1b) ────────
// Stratégies de l'organisation active (type, période, statut, version, référence interne) ; création réservée aux
// rédacteurs (peutRedigerStrategie). API : /api/strategies. Spec : docs/specs/strategie-cyber-it-resilience.md.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Target } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { STRATEGIE_TYPES, type StrategieType } from '@/lib/strategie'
import { droitsStrategie, messageErreurStrategie } from '@/lib/strategie-ui'
import type { UserRole } from '@/lib/permissions'
import IdentifiantsEditor, { identifiantsPourApi, type IdentifiantsSaisie } from './IdentifiantsEditor'

interface StrategieResume {
  id: string; titre: string; type: string; statut: string; version: number
  periodeDebut: string | null; periodeFin: string | null; referenceInterne: string | null
}

export const STATUT_STYLE: Record<string, string> = {
  BROUILLON: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  VALIDEE: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  ARCHIVEE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
}

/** Période lisible « début – fin » (dates calendaires, UTC) ; rien → null. */
export function periodeLisible(debut: string | null, fin: string | null, locale: string): string | null {
  const f = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale, { timeZone: 'UTC' }) : '…')
  return debut || fin ? `${f(debut)} – ${f(fin)}` : null
}

const VIDE = { titre: '', type: 'CYBER' as StrategieType, periodeDebut: '', periodeFin: '', description: '' }

export default function StrategiesListe({ role }: { role: UserRole }) {
  const { t, locale } = useTranslation()
  const s = t.strategie
  const u = s.ui
  const router = useRouter()
  const droits = droitsStrategie(role)
  const [liste, setListe] = useState<StrategieResume[] | null>(null)
  const [form, setForm] = useState<typeof VIDE | null>(null)
  const [ids, setIds] = useState<IdentifiantsSaisie>({ referenceInterne: '', identifiantsExternes: [] })
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    fetch('/api/strategies').then(r => (r.ok ? r.json() : null)).then(d => setListe(d?.strategies ?? [])).catch(() => setListe([]))
  }, [])

  async function creer(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setEnvoi(true); setErreur(null)
    const body = {
      titre: form.titre, type: form.type, description: form.description || null,
      periodeDebut: form.periodeDebut || null, periodeFin: form.periodeFin || null, ...identifiantsPourApi(ids),
    }
    const r = await fetch('/api/strategies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setEnvoi(false)
    if (r?.ok && d?.strategie?.id) { router.push(`/strategie/${d.strategie.id}`); return }
    setErreur(messageErreurStrategie(d?.error, s.erreurs, u.erreurDefaut))
  }

  const champ = 'mt-1 block w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600'
  const lbl = 'block text-xs text-gray-600 dark:text-gray-300'

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100"><Target size={24} className="inline align-[-0.16em] mr-2 text-ebios-600" aria-hidden="true" />{u.titre}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{u.sousTitre}</p>
        </div>
        {droits.rediger && !form && (
          <button type="button" onClick={() => { setErreur(null); setForm(VIDE) }} className="btn-primary text-sm inline-flex items-center gap-1.5">
            <Plus size={15} aria-hidden="true" />{u.nouvelle}
          </button>
        )}
      </header>

      {form && (
        <form onSubmit={creer} className="card p-4 space-y-3" aria-label={u.nouvelle}>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{u.nouvelle}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className={lbl}>{u.champTitre}
              <input className={champ} required maxLength={200} value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })} />
            </label>
            <label className={lbl}>{u.champType}
              <select className={champ} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as StrategieType })}>
                {STRATEGIE_TYPES.map(ty => <option key={ty} value={ty}>{s.types[ty]}</option>)}
              </select>
            </label>
            <label className={lbl}>{u.champDebut}
              <input type="date" className={champ} value={form.periodeDebut} onChange={e => setForm({ ...form, periodeDebut: e.target.value })} />
            </label>
            <label className={lbl}>{u.champFin}
              <input type="date" className={champ} value={form.periodeFin} min={form.periodeDebut || undefined} onChange={e => setForm({ ...form, periodeFin: e.target.value })} />
            </label>
          </div>
          <label className={lbl}>{u.champDescription}
            <textarea className={champ} rows={3} maxLength={4000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </label>
          <IdentifiantsEditor value={ids} onChange={setIds} />
          {erreur && <p role="alert" className="text-sm text-red-600">{erreur}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={envoi} className="btn-primary text-sm">{u.creer}</button>
            <button type="button" onClick={() => setForm(null)} className="btn-secondary text-sm">{u.annuler}</button>
          </div>
        </form>
      )}

      {liste === null ? <p className="text-sm text-gray-400">{u.chargement}</p> : liste.length === 0 ? (
        <p className="text-sm text-gray-500">{u.vide}</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <tr>{[u.colTitre, u.colType, u.colPeriode, u.colStatut, u.colVersion, u.colReference].map(c => <th key={c} scope="col" className="px-3 py-2">{c}</th>)}</tr>
            </thead>
            <tbody>
              {liste.map(st => (
                <tr key={st.id} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-2"><Link href={`/strategie/${st.id}`} className="text-ebios-700 dark:text-ebios-300 hover:underline">{st.titre}</Link></td>
                  <td className="px-3 py-2">{(s.types as Record<string, string>)[st.type] ?? st.type}</td>
                  <td className="px-3 py-2">{periodeLisible(st.periodeDebut, st.periodeFin, locale) ?? u.periodeVide}</td>
                  <td className="px-3 py-2"><span className={`text-xs px-1.5 py-0.5 rounded-sm ${STATUT_STYLE[st.statut] ?? ''}`}>{(s.statuts as Record<string, string>)[st.statut] ?? st.statut}</span></td>
                  <td className="px-3 py-2">{u.versionN.replace('{n}', String(st.version))}</td>
                  <td className="px-3 py-2">{st.referenceInterne ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
