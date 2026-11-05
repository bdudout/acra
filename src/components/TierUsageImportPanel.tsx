'use client'
// ─── Import des points d'accès et de la qualification des usages TIC (CSV / XLSX) ────────────────────────────────────
// Aperçu ligne à ligne (prête / ignorée / erreur + raison) puis application. Rattachement à des usages EXISTANTS
// uniquement (tiers + offre + cas d'usage) : aucun tiers, offre ni usage n'est créé. cf. lib/tier-usage-import.
import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { checkTabularUpload } from '@/lib/import-file-format'
import { readBytes, toBase64 } from '@/components/TicContractImportPanel'

type Ligne = { line: number; statut: 'OK' | 'IGNOREE' | 'ERREUR'; erreur?: string }
type Resultat = { lines: Ligne[]; counts: { ok: number; ignorees: number; erreurs: number; points: number; qualifications: number }; points?: number; qualifications?: number; plafond?: number }
const MODELE = '﻿Prestataire;Service;Cas d’usage;URL;Type;Environnement;Authentification;PCI;Avec SI;Exposition;Interconnexion\nPSP Exemple;Passerelle de paiement;Paiement carte;https://api.psp.example/v2;API;production;certificat;oui;oui;Internet;LS\nAcme SaaS;CRM;Relation client;acme.my.crm.example;SaaS;production;SSO;non;oui;Internet;Internet\n'

export default function TierUsageImportPanel({ onImported }: { onImported: () => void }) {
  const { t } = useTranslation()
  const c = t.usageImport
  const errs = t.analyses.importMenu.importErrors as Record<string, { title: string; likelyCauses: string; solution: string } | undefined>
  const [fichier, setFichier] = useState<{ name: string; data: string } | null>(null)
  const [res, setRes] = useState<Resultat | null>(null)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [fait, setFait] = useState(false)

  const decrire = (code: string, headers?: string[]) => {
    if (code === 'usage_import_columns_missing') return c.colonnesManquantes.replace('{headers}', (headers ?? []).join(', '))
    const k = errs[code]; return k ? `${k.title}. ${k.likelyCauses} ${k.solution}` : c.echec
  }
  async function envoyer(dryRun: boolean, f = fichier) {
    const r = await fetch('/api/tier-registry/usages/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: f!.name, data: f!.data, dryRun }) })
    return { ok: r.ok, body: await r.json().catch(() => ({})) }
  }
  async function surFichier(sel: File | undefined) {
    if (!sel) return
    setErreur(null); setRes(null); setFait(false)
    const fmt = checkTabularUpload(sel.name, await readBytes(sel.slice(0, 16)))
    if (fmt) { setErreur(decrire(fmt)); return }
    setBusy(true)
    try {
      const f = { name: sel.name, data: await toBase64(sel) }
      setFichier(f)
      const { ok, body } = await envoyer(true, f)
      if (!ok) { setErreur(decrire(body.error, body.headers)); return }
      setRes(body)
    } catch { setErreur(c.echec) } finally { setBusy(false) }
  }
  async function appliquer() {
    setBusy(true); setErreur(null)
    try {
      const { ok, body } = await envoyer(false)
      if (!ok) { setErreur(decrire(body.error, body.headers)); return }
      setRes(body); setFait(true); onImported()
    } catch { setErreur(c.echec) } finally { setBusy(false) }
  }
  function modele() {
    const url = URL.createObjectURL(new Blob([MODELE], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'usages-tic-modele.csv'; a.click(); URL.revokeObjectURL(url)
  }
  const raisons = c.raisons as Record<string, string>
  const ton = (s: Ligne['statut']) => (s === 'OK' ? 'text-green-800 dark:text-green-300' : s === 'ERREUR' ? 'text-red-700 dark:text-red-300' : 'text-amber-800 dark:text-amber-300')

  return (
    <section className="card mb-4 space-y-3 p-4" aria-label={c.titre}>
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{c.titre}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">{c.aide}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-700 dark:text-gray-200">{c.fichier}
          <input type="file" accept=".csv,.xlsx" aria-label={c.fichier} className="mt-1 block text-sm" disabled={busy} onChange={e => { void surFichier(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        <button type="button" className="btn-secondary text-sm" onClick={modele}>{c.modele}</button>
      </div>
      {erreur && <p role="alert" className="rounded-sm border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100">{erreur}</p>}
      {fait && res && <p role="status" className="rounded-sm border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-700 dark:bg-green-950/40 dark:text-green-100">✓ {c.applique.replace('{p}', String(res.points ?? 0)).replace('{q}', String(res.qualifications ?? 0))}{(res.plafond ?? 0) > 0 && ` ${c.plafond.replace('{n}', String(res.plafond))}`}</p>}
      {res && (
        <>
          <p data-testid="compteurs" className="text-sm text-gray-700 dark:text-gray-200">
            {c.compteurs.replace('{ok}', String(res.counts.ok)).replace('{ign}', String(res.counts.ignorees)).replace('{err}', String(res.counts.erreurs)).replace('{p}', String(res.counts.points)).replace('{q}', String(res.counts.qualifications))}
          </p>
          <div className="max-h-80 overflow-auto rounded-sm border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"><tr><th className="px-2 py-1">{c.colLigne}</th><th className="px-2 py-1">{c.colStatut}</th></tr></thead>
              <tbody>{res.lines.map(l => (
                <tr key={l.line} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-2 py-1 text-gray-500">{l.line}</td>
                  <td className={`px-2 py-1 ${ton(l.statut)}`}><span className="font-medium">{(c.statuts as Record<string, string>)[l.statut]}</span>{l.erreur && <span> — {raisons[l.erreur] ?? l.erreur}</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {!fait && <button type="button" className="btn-primary text-sm disabled:opacity-50" disabled={busy || res.counts.ok === 0} aria-busy={busy} onClick={() => void appliquer()}>{busy ? c.enCours : c.appliquer.replace('{n}', String(res.counts.ok))}</button>}
        </>
      )}
    </section>
  )
}
