'use client'

// Gestion des ENTITÉS (sous-organisations) et de leurs RÔLES par l'ADMIN d'une
// organisation, depuis /configuration/entites. Réutilise OrgMembership (role+scope)
// via l'API /api/organizations/[orgId]/entites[/[entiteId]/membres]. Toutes les
// actions sont contraintes côté serveur au sous-arbre de l'organisation.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, UserPlus, Trash2, Plus, CornerDownRight } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { ROLE_LABELS } from '@/lib/permissions'

const ASSIGNABLE_ROLES = ['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN', 'DIRECTION_METIER'] as const
type AssignableRole = typeof ASSIGNABLE_ROLES[number]

interface Entite { id: string; nom: string; parentId: string | null; actif: boolean; depth: number; isRoot: boolean; membres: number; analyses: number }
interface Member { id: string; role: string; scope: string; user: { id: string; name: string | null; email: string } }

export default function EntitesRolesManager({ orgId }: { orgId: string }) {
  const { t } = useTranslation()
  const e = t.entites
  const base = `/api/organizations/${orgId}/entites`

  const [entites, setEntites] = useState<Entite[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newNom, setNewNom] = useState('')
  const [newParent, setNewParent] = useState('')
  const [adding, setAdding] = useState(false)

  const [mEmail, setMEmail] = useState('')
  const [mRole, setMRole] = useState<AssignableRole>('ANALYSTE')
  const [mScope, setMScope] = useState<'NODE' | 'SUBTREE'>('NODE')
  const [addingMember, setAddingMember] = useState(false)

  const loadEntites = useCallback(async () => {
    setLoading(true); setError(null)
    const res = await fetch(base).then(r => r.ok ? r.json() : null).catch(() => null)
    setEntites(Array.isArray(res?.entites) ? res.entites : [])
    setLoading(false)
  }, [base])

  useEffect(() => { loadEntites() }, [loadEntites])

  const loadMembers = useCallback(async (id: string) => {
    const res = await fetch(`${base}/${id}/membres`).then(r => r.ok ? r.json() : null).catch(() => null)
    setMembers(Array.isArray(res?.members) ? res.members : [])
  }, [base])

  useEffect(() => { if (selId) loadMembers(selId); else setMembers([]) }, [selId, loadMembers])

  async function creerEntite() {
    const nom = newNom.trim()
    if (!nom) return
    setAdding(true); setError(null)
    const res = await fetch(base, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, parentId: newParent || undefined }),
    })
    setAdding(false)
    if (!res.ok) { setError(e.error); return }
    setNewNom(''); setNewParent('')
    await loadEntites()
  }

  async function ajouterMembre() {
    if (!selId || !mEmail.trim()) return
    setAddingMember(true); setError(null)
    const res = await fetch(`${base}/${selId}/membres`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: mEmail.trim(), role: mRole, scope: mScope }),
    })
    setAddingMember(false)
    if (!res.ok) { setError(e.error); return }
    setMEmail('')
    await Promise.all([loadMembers(selId), loadEntites()])
  }

  async function retirerMembre(membershipId: string) {
    if (!selId || !confirm(e.removeConfirm)) return
    const res = await fetch(`${base}/${selId}/membres?membershipId=${encodeURIComponent(membershipId)}`, { method: 'DELETE' })
    if (!res.ok) { setError(e.error); return }
    await Promise.all([loadMembers(selId), loadEntites()])
  }

  const selected = entites.find(x => x.id === selId) ?? null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Building2 size={22} aria-hidden="true" /> {e.title}</h1>
        <p className="text-gray-500 text-sm mt-0.5 max-w-2xl">{e.subtitle}</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}

      {/* Ajouter une entité */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">{e.addTitle}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-500 flex-1 min-w-[16rem]">
            <span className="block font-medium mb-1">{e.nomLabel}</span>
            <input value={newNom} onChange={ev => setNewNom(ev.target.value)} placeholder={e.nomPh}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white text-gray-800" />
          </label>
          <label className="text-xs text-gray-500 min-w-[14rem]">
            <span className="block font-medium mb-1">{e.parentLabel}</span>
            <select value={newParent} onChange={ev => setNewParent(ev.target.value)}
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white text-gray-800">
              {entites.map(x => <option key={x.id} value={x.isRoot ? '' : x.id}>{' '.repeat(x.depth * 2)}{x.nom}{x.isRoot ? ` (${e.rootBadge})` : ''}</option>)}
            </select>
          </label>
          <button onClick={creerEntite} disabled={adding || !newNom.trim()}
            className="btn-primary text-sm py-1.5 px-3 inline-flex items-center gap-1.5 disabled:opacity-50">
            <Plus size={14} aria-hidden="true" /> {adding ? e.adding : e.addBtn}
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Arborescence */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">{e.treeTitle}</h2>
          {loading ? <p className="text-gray-400 text-sm py-6 text-center">{e.loading}</p> : (
            <ul className="space-y-1">
              {entites.map(x => (
                <li key={x.id}>
                  <button onClick={() => setSelId(x.id)}
                    style={{ paddingLeft: `${8 + x.depth * 18}px` }}
                    className={`w-full text-left rounded-md px-2 py-1.5 text-sm flex items-center gap-1.5 transition ${selId === x.id ? 'bg-ebios-50 ring-1 ring-ebios-300 text-ebios-900' : 'hover:bg-gray-50 text-gray-800'}`}>
                    {x.depth > 0 && <CornerDownRight size={13} className="text-gray-300 shrink-0" aria-hidden="true" />}
                    <span className="font-medium truncate">{x.nom}</span>
                    {x.isRoot && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 shrink-0">{e.rootBadge}</span>}
                    <span className="ml-auto text-[11px] text-gray-400 shrink-0">{e.membresN.replace('{n}', String(x.membres))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Membres de l'entité sélectionnée */}
        <div className="card p-4">
          {!selected ? (
            <p className="text-gray-400 text-sm py-6 text-center">{e.selectEntite}</p>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-gray-800 mb-3">{e.membresTitle.replace('{nom}', selected.nom)}</h2>
              <ul className="divide-y divide-gray-100 mb-4">
                {members.length === 0 && <li className="text-gray-400 text-sm py-3">{e.noMembers}</li>}
                {members.map(m => (
                  <li key={m.id} className="flex items-center gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="text-gray-800 truncate">{m.user.name || m.user.email}</div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {m.user.email} · {ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] ?? m.role} · {m.scope === 'SUBTREE' ? e.scopeSubtree : e.scopeNode}
                      </div>
                    </div>
                    <button onClick={() => retirerMembre(m.id)} title={e.remove}
                      className="ml-auto text-gray-400 hover:text-red-600 shrink-0"><Trash2 size={15} aria-hidden="true" /></button>
                  </li>
                ))}
              </ul>

              <div className="border-t border-gray-100 pt-3 space-y-2">
                <label className="text-xs text-gray-500 block">
                  <span className="block font-medium mb-1">{e.emailLabel}</span>
                  <input value={mEmail} onChange={ev => setMEmail(ev.target.value)} placeholder={e.emailPh} type="email"
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white text-gray-800" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <label className="text-xs text-gray-500 flex-1 min-w-[9rem]">
                    <span className="block font-medium mb-1">{e.roleLabel}</span>
                    <select value={mRole} onChange={ev => setMRole(ev.target.value as AssignableRole)}
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white text-gray-800">
                      {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-gray-500 flex-1 min-w-[9rem]">
                    <span className="block font-medium mb-1">{e.scopeLabel}</span>
                    <select value={mScope} onChange={ev => setMScope(ev.target.value as 'NODE' | 'SUBTREE')}
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white text-gray-800">
                      <option value="NODE">{e.scopeNode}</option>
                      <option value="SUBTREE">{e.scopeSubtree}</option>
                    </select>
                  </label>
                </div>
                <button onClick={ajouterMembre} disabled={addingMember || !mEmail.trim()}
                  className="btn-secondary text-sm py-1.5 px-3 inline-flex items-center gap-1.5 disabled:opacity-50">
                  <UserPlus size={14} aria-hidden="true" /> {e.addMember}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Note TPE : périmètres nommés au lieu d'entités */}
      <div className="card p-4 border-l-4 border-l-ebios-300 bg-ebios-50/40">
        <p className="text-sm text-gray-700">{e.tpeNote}</p>
        <Link href="/conformite/socle" className="inline-block mt-1.5 text-sm font-medium text-ebios-600 hover:underline">{e.tpeNoteLink} →</Link>
      </div>
    </div>
  )
}
