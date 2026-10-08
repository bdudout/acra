'use client'

// ─── Registre du sous-traitant (RGPD art. 30 §2) ──────────────────────────────
// Une ligne par responsable du traitement client : coordonnées (et DPO), catégories de traitements effectués pour son
// compte, transferts vers un pays tiers et garanties, mesures de sécurité ; manques du §2 en clair. Module activable.
// API : /api/ropa/sous-traitance.
import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import type { SousTraitance } from '@/lib/ropa-sous-traitance'

type Ligne = SousTraitance & { id: string; manquants: string[] }
type Form = { clientNom: string; clientContact: string; clientDpo: string; categories: string; transfertHorsUE: boolean; paysTransfert: string; garantiesTransfert: string; mesures: string }
const VIDE: Form = { clientNom: '', clientContact: '', clientDpo: '', categories: '', transfertHorsUE: false, paysTransfert: '', garantiesTransfert: '', mesures: '' }
const enListe = (s: string) => s.split(/[,;\n]/).map(x => x.trim()).filter(Boolean)

export default function RopaSousTraitanceManager() {
  const { t } = useTranslation()
  const r = t.ropa.sousTraitance
  const [lignes, setLignes] = useState<Ligne[] | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const recharger = useCallback(() => fetch('/api/ropa/sous-traitance').then(x => (x.ok ? x.json() : { lignes: [] }))
    .then((j: { lignes?: Ligne[] }) => setLignes(j.lignes ?? [])).catch(() => setLignes([])), [])
  useEffect(() => { recharger() }, [recharger])

  const libelle: Record<string, string> = {
    clientNom: r.client, clientContact: r.clientContact, categoriesTraitements: r.categories, mesuresSecurite: r.mesures, garantiesTransfert: r.garanties,
  }

  async function enregistrer() {
    if (!form) return
    setErreur(null)
    const corps = { clientNom: form.clientNom, clientContact: form.clientContact, clientDpo: form.clientDpo, categoriesTraitements: enListe(form.categories),
      transfertHorsUE: form.transfertHorsUE, paysTransfert: form.paysTransfert, garantiesTransfert: form.garantiesTransfert, mesuresSecurite: enListe(form.mesures) }
    const res = await fetch(editId ? `/api/ropa/sous-traitance/${editId}` : '/api/ropa/sous-traitance', { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) }).catch(() => null)
    if (!res?.ok) { setErreur(r.erreur); return }
    setForm(null); setEditId(null); recharger()
  }
  function editer(l: Ligne) {
    setEditId(l.id); setErreur(null)
    setForm({ clientNom: l.clientNom, clientContact: l.clientContact, clientDpo: l.clientDpo, categories: l.categoriesTraitements.join(', '), transfertHorsUE: l.transfertHorsUE, paysTransfert: l.paysTransfert, garantiesTransfert: l.garantiesTransfert, mesures: l.mesuresSecurite.join(', ') })
  }
  async function supprimer(id: string) {
    if (!window.confirm(r.confirmer)) return
    await fetch(`/api/ropa/sous-traitance/${id}`, { method: 'DELETE' }).catch(() => null)
    recharger()
  }

  if (!lignes) return <p className="text-sm text-gray-400">…</p>
  const champ = 'mt-1 block w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-900 dark:border-gray-600'
  const label = 'text-xs text-gray-500 dark:text-gray-400'
  const saisir = (k: Exclude<keyof Form, 'transfertHorsUE'>, lib: string) => (
    <label className={label}>{lib}<input aria-label={lib} value={form![k]} onChange={e => setForm({ ...form!, [k]: e.target.value })} className={champ} /></label>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">{r.aide}</p>
        {!form && <button type="button" onClick={() => { setEditId(null); setErreur(null); setForm({ ...VIDE }) }} className="btn-primary text-sm inline-flex items-center gap-1"><Plus size={16} aria-hidden="true" />{r.ajouter}</button>}
      </div>
      {form && (
        <div className="card p-4 space-y-3">
          {erreur && <p role="alert" className="text-sm text-red-600">{erreur}</p>}
          <div className="grid md:grid-cols-3 gap-3">{saisir('clientNom', r.client)}{saisir('clientContact', r.clientContact)}{saisir('clientDpo', r.clientDpo)}</div>
          <div className="grid md:grid-cols-2 gap-3">{saisir('categories', r.categories)}{saisir('mesures', r.mesures)}</div>
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200"><input type="checkbox" checked={form.transfertHorsUE} onChange={e => setForm({ ...form, transfertHorsUE: e.target.checked })} />{r.transfert}</label>
          {form.transfertHorsUE && <div className="grid md:grid-cols-2 gap-3">{saisir('paysTransfert', r.pays)}{saisir('garantiesTransfert', r.garanties)}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={enregistrer} disabled={!form.clientNom.trim()} className="btn-primary text-sm">{r.enregistrer}</button>
            <button type="button" onClick={() => { setForm(null); setEditId(null) }} className="btn-secondary text-sm">{r.annuler}</button>
          </div>
        </div>
      )}
      {lignes.length === 0 ? <p className="text-sm italic text-gray-400">{r.vide}</p> : (
        <div className="overflow-x-auto card">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
              <th className="px-3 py-2">{r.client}</th><th className="px-3 py-2">{r.categories}</th><th className="px-3 py-2">{r.transfert}</th><th className="px-3 py-2" /><th className="px-3 py-2" />
            </tr></thead>
            <tbody>
              {lignes.map(l => (
                <tr key={l.id} className="border-b border-gray-100 dark:border-gray-800 align-top">
                  <td className="px-3 py-2"><span className="font-medium text-gray-800 dark:text-gray-100">{l.clientNom}</span>{l.clientContact && <span className="block text-xs text-gray-500">{l.clientContact}</span>}</td>
                  <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{l.categoriesTraitements.join(', ')}</td>
                  <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{l.transfertHorsUE ? l.paysTransfert || '✓' : '—'}</td>
                  <td className="px-3 py-2">
                    {l.manquants.length === 0
                      ? <span className="text-[11px] inline-flex items-center gap-1 text-green-700 bg-green-100 dark:bg-green-500/15 dark:text-green-300 px-1.5 py-0.5 rounded-full"><CheckCircle2 size={12} aria-hidden="true" />{r.complet}</span>
                      : <span className="text-[11px] inline-flex items-start gap-1 text-amber-800 dark:text-amber-300"><AlertTriangle size={12} className="mt-0.5" aria-hidden="true" />{r.manque.replace('{champs}', l.manquants.map(c => libelle[c] ?? c).join(', '))}</span>}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button type="button" onClick={() => editer(l)} className="text-xs text-ebios-600 hover:underline mr-2">{r.modifier}</button>
                    <button type="button" onClick={() => supprimer(l.id)} className="text-gray-400 hover:text-red-600 p-1" aria-label={`${r.supprimer} ${l.clientNom}`}><Trash2 size={15} aria-hidden="true" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
