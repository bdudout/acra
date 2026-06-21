'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import AdminNav from '@/components/AdminNav'
import { useTranslation } from '@/lib/i18n/context'
import { ROLE_LABELS } from '@/lib/permissions'
import { Building2, Plus, X, Users } from 'lucide-react'

interface OrgRow {
  id: string; nom: string; slug: string; parentId: string | null; path: string; actif: boolean
  _count: { membres: number; analyses: number }
}
interface Member {
  id: string; role: string; scope: string
  user: { id: string; name: string | null; email: string }
}

const ASSIGNABLE_ROLES = ['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN'] as const

export default function OrganizationsAdminPage() {
  const { t } = useTranslation()
  const o = t.admin.org
  const router = useRouter()
  const { data: session, status } = useSession()

  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newParent, setNewParent] = useState<string>('')
  const [selected, setSelected] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [mEmail, setMEmail] = useState('')
  const [mRole, setMRole] = useState<typeof ASSIGNABLE_ROLES[number]>('ANALYSTE')
  const [mScope, setMScope] = useState<'NODE' | 'SUBTREE'>('NODE')
  const [error, setError] = useState<string | null>(null)

  // Garde : réservé au SUPER_ADMIN.
  useEffect(() => {
    if (status === 'authenticated' && (session?.user as any)?.role !== 'SUPER_ADMIN') router.replace('/dashboard')
  }, [status, session, router])

  const loadOrgs = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/organizations', { cache: 'no-store' })
    if (res.ok) setOrgs((await res.json()).organizations ?? [])
    setLoading(false)
  }, [])

  const loadMembers = useCallback(async (orgId: string) => {
    const res = await fetch(`/api/admin/organizations/${orgId}/members`, { cache: 'no-store' })
    if (res.ok) setMembers((await res.json()).members ?? [])
  }, [])

  useEffect(() => { loadOrgs() }, [loadOrgs])
  useEffect(() => { if (selected) loadMembers(selected) }, [selected, loadMembers])

  async function createOrg(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const res = await fetch('/api/admin/organizations', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nom: newName, parentId: newParent || null }),
    })
    if (res.ok) { setNewName(''); setNewParent(''); await loadOrgs() }
    else setError((await res.json().catch(() => ({}))).error ?? 'Erreur')
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setError(null)
    const res = await fetch(`/api/admin/organizations/${selected}/members`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: mEmail, role: mRole, scope: mScope }),
    })
    if (res.ok) { setMEmail(''); await loadMembers(selected); await loadOrgs() }
    else setError((await res.json().catch(() => ({}))).error ?? 'Erreur')
  }

  async function removeMember(mid: string) {
    if (!selected) return
    const res = await fetch(`/api/admin/organizations/${selected}/members?membershipId=${mid}`, { method: 'DELETE' })
    if (res.ok) { await loadMembers(selected); await loadOrgs() }
  }

  const depth = (org: OrgRow) => Math.max(0, org.path.split('/').filter(Boolean).length - 1)
  const selectedOrg = orgs.find(x => x.id === selected) ?? null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gray-800">
          <Building2 size={22} className="text-ebios-600" /> {o.title}
        </h1>
        <p className="mb-6 text-sm text-gray-500">{o.subtitle}</p>
        <AdminNav active="organizations" />

        {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Arbre des organisations */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-gray-800">{o.title}</h2>
            {loading ? (
              <p className="text-sm text-gray-400">…</p>
            ) : orgs.length === 0 ? (
              <p className="text-sm text-gray-400">{o.empty}</p>
            ) : (
              <ul className="space-y-1">
                {orgs.map(org => (
                  <li key={org.id}>
                    <button
                      onClick={() => setSelected(org.id)}
                      style={{ marginLeft: depth(org) * 18 }}
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm ${selected === org.id ? 'bg-ebios-50 text-ebios-700' : 'hover:bg-gray-50 text-gray-700'}`}
                    >
                      <span className="truncate font-medium">
                        {org.nom}
                        {!org.parentId && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">{o.rootBadge}</span>}
                      </span>
                      <span className="shrink-0 text-xs text-gray-400">
                        {org._count.membres} <Users size={11} className="inline" /> · {org._count.analyses} {o.analyses}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Créer une organisation */}
            <form onSubmit={createOrg} className="mt-4 space-y-2 border-t border-gray-100 pt-4">
              <input
                value={newName} onChange={e => setNewName(e.target.value)} required maxLength={120}
                placeholder={o.name}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
              <select value={newParent} onChange={e => setNewParent(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm">
                <option value="">{o.noParent}</option>
                {orgs.map(org => <option key={org.id} value={org.id}>{org.nom}</option>)}
              </select>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-ebios-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-ebios-700">
                <Plus size={15} /> {o.create}
              </button>
            </form>
          </section>

          {/* Membres de l'organisation sélectionnée */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-gray-800">
              {o.members}{selectedOrg ? ` — ${selectedOrg.nom}` : ''}
            </h2>
            {!selectedOrg ? (
              <p className="text-sm text-gray-400">{o.title} →</p>
            ) : (
              <>
                <ul className="mb-4 space-y-1">
                  {members.map(m => (
                    <li key={m.id} className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-gray-50">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-700">{m.user.name || m.user.email}</span>
                        <span className="block truncate text-xs text-gray-400">
                          {m.user.email} · {ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] ?? m.role} · {m.scope === 'SUBTREE' ? o.scopeSubtree : o.scopeNode}
                        </span>
                      </span>
                      <button onClick={() => removeMember(m.id)} title={o.remove} className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
                        <X size={15} />
                      </button>
                    </li>
                  ))}
                </ul>

                <form onSubmit={addMember} className="space-y-2 border-t border-gray-100 pt-4">
                  <input
                    value={mEmail} onChange={e => setMEmail(e.target.value)} required type="email"
                    placeholder={o.email}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                  <div className="flex gap-2">
                    <select value={mRole} onChange={e => setMRole(e.target.value as typeof mRole)} className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                      {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                    <select value={mScope} onChange={e => setMScope(e.target.value as typeof mScope)} className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                      <option value="NODE">{o.scopeNode}</option>
                      <option value="SUBTREE">{o.scopeSubtree}</option>
                    </select>
                  </div>
                  <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-ebios-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-ebios-700">
                    <Plus size={15} /> {o.addMember}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
