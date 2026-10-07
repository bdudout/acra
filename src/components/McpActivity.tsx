'use client'

// ─── Activité MCP de l'organisation (administrateur) ─────────────────────────
// Suivi des assistants connectés au serveur MCP : nombre de clés, appels et erreurs sur 30 jours, outils les plus
// appelés, propositions déposées par clé ; création d'une clé MCP (secret montré une seule fois, avec la commande de
// connexion) et révocation immédiate. Données : GET /api/mcp-activity ; clés : /api/config/api-keys.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bot, Copy, Check, KeyRound, Trash2, AlertTriangle } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

interface Cle {
  id: string; nom: string; masque: string; etat: 'ACTIVE' | 'REVOQUEE' | 'EXPIREE'
  lastUsedAt: string | null; expiresAt: string | null
  appels: number; erreurs: number; outils: { outil: string; n: number }[]
  propositions: { EN_ATTENTE: number; ACCEPTEE: number; REJETEE: number }
}
interface Activite {
  instanceActive: boolean; orgActive: boolean; jours: number
  totaux: { clesActives: number; clesInactives: number; appels: number; erreurs: number; enAttente: number; acceptees: number; rejetees: number }
  parJour: { jour: string; n: number }[]
  cles: Cle[]
}

const ETAT_STYLE: Record<Cle['etat'], string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  REVOQUEE: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
  EXPIREE: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
}

export default function McpActivity() {
  const { t, locale } = useTranslation()
  const a = t.mcpActivite
  const [data, setData] = useState<Activite | null>(null)
  const [interdit, setInterdit] = useState(false)
  const [nom, setNom] = useState('')
  const [expiration, setExpiration] = useState('')
  const [secret, setSecret] = useState<string | null>(null)
  const [copie, setCopie] = useState(false)
  const [busy, setBusy] = useState(false)

  async function reload() {
    const res = await fetch('/api/mcp-activity').catch(() => null)
    if (res && res.status === 403) { setInterdit(true); return }
    if (res && res.ok) setData(await res.json())
  }
  useEffect(() => { reload() }, [])

  async function creer() {
    setBusy(true); setSecret(null)
    const res = await fetch('/api/config/api-keys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nom || undefined, scopes: ['mcp'], expiresAt: expiration || undefined }),
    }).catch(() => null)
    setBusy(false)
    if (!res?.ok) return
    const d = await res.json().catch(() => ({}))
    setSecret(d.secret ?? null); setNom(''); setExpiration(''); reload()
  }

  async function revoquer(c: Cle) {
    if (!confirm(a.revoquerConfirm)) return
    await fetch(`/api/config/api-keys/${c.id}`, { method: 'DELETE' })
    reload()
  }

  const urlMcp = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/mcp`
  const commande = secret ? `claude mcp add --transport http acra ${urlMcp} --header "Authorization: Bearer ${secret}"` : ''
  function copier() {
    navigator.clipboard?.writeText(commande).then(() => { setCopie(true); setTimeout(() => setCopie(false), 1800) }).catch(() => {})
  }
  const date = (d: string | null) => (d ? new Date(d).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }) : '—')

  if (interdit) return <p className="text-sm text-gray-500 dark:text-gray-400">{a.interdit}</p>
  if (!data) return <p className="text-sm text-gray-400">…</p>

  const max = Math.max(1, ...data.parJour.map(j => j.n))
  const tuiles = [
    { label: a.clesActives, v: data.totaux.clesActives },
    { label: a.clesInactives, v: data.totaux.clesInactives },
    { label: a.appels.replace('{j}', String(data.jours)), v: data.totaux.appels },
    { label: a.erreurs, v: data.totaux.erreurs },
    { label: a.enAttente, v: data.totaux.enAttente },
  ]
  const inp = 'px-2 py-1.5 rounded-sm border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'

  return (
    <div className="space-y-6">
      {(!data.instanceActive || !data.orgActive) && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {!data.instanceActive ? a.coupeInstance : a.coupeOrg}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {tuiles.map(x => (
          <div key={x.label} className="card p-4">
            <p className="text-2xl font-semibold text-gray-800 dark:text-gray-100">{x.v}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{x.label}</p>
          </div>
        ))}
      </div>

      <section className="card p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{a.parJour}</h2>
        <div className="flex items-end gap-0.5 h-24" aria-hidden="true">
          {data.parJour.map(j => (
            <div key={j.jour} title={`${j.jour} : ${j.n}`} className="flex-1 bg-ebios-500/70 dark:bg-ebios-400/60 rounded-t" style={{ height: `${Math.max(j.n ? 4 : 1, (j.n / max) * 100)}%` }} />
          ))}
        </div>
        <Link href="/mcp-propositions" className="inline-block mt-3 text-xs text-ebios-600 hover:underline">{a.voirPropositions}</Link>
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 inline-flex items-center gap-2"><KeyRound size={16} aria-hidden="true" />{a.nouvelleCle}</h2>
        {secret && (
          <div className="mb-4 rounded-lg border border-ebios-300 bg-ebios-50 dark:bg-ebios-500/10 dark:border-ebios-500/30 p-3 space-y-2">
            <p className="text-xs font-medium text-ebios-800 dark:text-ebios-200">{a.secretUneFois}</p>
            <code className="block text-xs break-all bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-sm px-2 py-1.5 font-mono">{secret}</code>
            <p className="text-xs text-gray-600 dark:text-gray-300">{a.connexion}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs break-all bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-sm px-2 py-1.5 font-mono">{commande}</code>
              <button onClick={copier} className="btn-secondary text-xs inline-flex items-center gap-1">{copie ? <Check size={14} /> : <Copy size={14} />} {copie ? a.copie : a.copier}</button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{a.autresClients.replace('{url}', urlMcp)}</p>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-500 dark:text-gray-400">{a.nomCle}
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder={a.nomPh} className={`${inp} block mt-1`} />
          </label>
          <label className="text-xs text-gray-500 dark:text-gray-400">{a.expiration}
            <input type="date" value={expiration} onChange={e => setExpiration(e.target.value)} className={`${inp} block mt-1`} />
          </label>
          <button onClick={creer} disabled={busy} className="btn-primary text-sm disabled:opacity-50">{a.creer}</button>
        </div>
      </section>

      <section className="card p-4">
        {data.cles.length === 0 ? <p className="text-sm text-gray-400 italic">{a.aucune}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2">{a.colNom}</th><th className="px-3 py-2">{a.colEtat}</th><th className="px-3 py-2">{a.colDernier}</th>
                <th className="px-3 py-2">{a.colAppels}</th><th className="px-3 py-2">{a.colOutils}</th><th className="px-3 py-2">{a.colPropositions}</th><th className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {data.cles.map(c => (
                  <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800 align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-800 dark:text-gray-100 inline-flex items-center gap-1.5"><Bot size={14} aria-hidden="true" />{c.nom}</p>
                      <p className="font-mono text-xs text-gray-400">{c.masque}</p>
                    </td>
                    <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${ETAT_STYLE[c.etat]}`}>{a.etats[c.etat]}</span></td>
                    <td className="px-3 py-2 text-xs text-gray-500">{date(c.lastUsedAt)}</td>
                    <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">{c.appels}{c.erreurs ? <span className="text-red-600 dark:text-red-400"> · {a.erreursN.replace('{n}', String(c.erreurs))}</span> : null}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{c.outils.length ? c.outils.map(o => <span key={o.outil} className="block">{`${o.outil} (${o.n})`}</span>) : '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{a.propositions.replace('{a}', String(c.propositions.EN_ATTENTE)).replace('{o}', String(c.propositions.ACCEPTEE)).replace('{r}', String(c.propositions.REJETEE))}</td>
                    <td className="px-3 py-2 text-right">
                      {c.etat === 'ACTIVE' && (
                        <button onClick={() => revoquer(c)} aria-label={`${a.revoquer} ${c.nom}`} className="text-xs inline-flex items-center gap-1 text-gray-500 hover:text-red-600">
                          <Trash2 size={14} aria-hidden="true" />{a.revoquer}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
