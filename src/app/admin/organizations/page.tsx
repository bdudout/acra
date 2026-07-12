'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import AdminNav from '@/components/AdminNav'
import { useTranslation } from '@/lib/i18n/context'
import { ROLE_LABELS } from '@/lib/permissions'
import OrgLogo from '@/components/OrgLogo'
import { Building2, Plus, X, Users } from 'lucide-react'

interface OrgRow {
  id: string; nom: string; slug: string; parentId: string | null; path: string; actif: boolean
  logo?: string | null
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
  const [busy, setBusy] = useState(false)
  const [scalesScope, setScalesScope] = useState<'SHARED' | 'PER_ORG'>('SHARED')

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
  useEffect(() => {
    fetch('/api/admin/scales-scope', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.scalesScope) setScalesScope(d.scalesScope) })
      .catch(() => {})
  }, [])

  async function changeScalesScope(mode: 'SHARED' | 'PER_ORG') {
    setScalesScope(mode)
    await fetch('/api/admin/scales-scope', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scalesScope: mode }),
    }).catch(() => {})
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null); setBusy(true)
    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nom: newName, parentId: newParent || null }),
      })
      if (res.ok) {
        const created = (await res.json()).organization
        setNewName(''); setNewParent(''); await loadOrgs()
        if (created?.id) setSelected(created.id) // sélection auto de l'org créée
      } else setError((await res.json().catch(() => ({}))).error ?? 'Erreur')
    } finally { setBusy(false) }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || busy) return
    setError(null); setBusy(true)
    try {
      const res = await fetch(`/api/admin/organizations/${selected}/members`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: mEmail, role: mRole, scope: mScope }),
      })
      if (res.ok) { setMEmail(''); await loadMembers(selected); await loadOrgs() }
      else setError((await res.json().catch(() => ({}))).error ?? 'Erreur')
    } finally { setBusy(false) }
  }

  async function removeMember(mid: string) {
    if (!selected) return
    if (!window.confirm(o.removeConfirm)) return
    const res = await fetch(`/api/admin/organizations/${selected}/members?membershipId=${mid}`, { method: 'DELETE' })
    if (res.ok) { await loadMembers(selected); await loadOrgs() }
  }

  // Logo : redimensionne l'image choisie en 64×64 (data URL) puis l'enregistre.
  function resizeImage(file: File, size: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size; canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('no ctx'))
        const scale = Math.max(size / img.width, size / img.height)
        const w = img.width * scale, h = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }
  async function setLogo(logo: string | null) {
    if (!selected) return
    const res = await fetch(`/api/admin/organizations/${selected}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ logo }),
    })
    if (res.ok) await loadOrgs()
    else setError((await res.json().catch(() => ({}))).error ?? 'Erreur')
  }
  async function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) { try { await setLogo(await resizeImage(f, 64)) } catch { /* ignore */ } }
    e.target.value = ''
  }

  const depth = (org: OrgRow) => Math.max(0, org.path.split('/').filter(Boolean).length - 1)
  const selectedOrg = orgs.find(x => x.id === selected) ?? null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <AdminNav active="organizations" />
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gray-800">
          <Building2 size={22} className="text-ebios-600" /> {o.title}
        </h1>
        <p className="mb-6 text-sm text-gray-500">{o.subtitle}</p>

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
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm ${selected === org.id ? 'bg-ebios-50 text-ebios-700' : 'hover:bg-gray-50 text-gray-700'}`}
                    >
                      <span className="flex min-w-0 items-center gap-2 font-medium" style={{ paddingLeft: depth(org) * 16 }}>
                        <OrgLogo id={org.id} nom={org.nom} logo={org.logo} size={20} className="shrink-0 rounded" />
                        <span className="truncate">{org.nom}</span>
                        {!org.parentId && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">{o.rootBadge}</span>}
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
              <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-md bg-ebios-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-ebios-700 disabled:opacity-50">
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
              <p className="text-sm text-gray-400">{o.selectHint}</p>
            ) : (
              <>
                {/* Logo de l'organisation : auto-généré, remplaçable par un logo personnalisé. */}
                <div className="mb-4 flex items-center gap-3 border-b border-gray-100 pb-3">
                  <OrgLogo id={selectedOrg.id} nom={selectedOrg.nom} logo={selectedOrg.logo} size={40} className="rounded-md" />
                  <div className="flex flex-col gap-1">
                    <label className="cursor-pointer text-xs font-medium text-ebios-700 hover:underline">
                      {o.logoChange}
                      <input type="file" accept="image/*" onChange={onLogoFile} className="hidden" />
                    </label>
                    {selectedOrg.logo && (
                      <button onClick={() => setLogo(null)} className="text-left text-xs text-gray-400 hover:text-red-600">{o.logoReset}</button>
                    )}
                  </div>
                </div>
                <ul className="mb-4 space-y-1">
                  {members.map(m => (
                    <li key={m.id} className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-gray-50">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-700">{m.user.name || m.user.email}</span>
                        <span className="block truncate text-xs text-gray-400">
                          {m.user.email} · {ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] ?? m.role} · {m.scope === 'SUBTREE' ? o.scopeSubtree : o.scopeNode}
                        </span>
                      </span>
                      <button onClick={() => removeMember(m.id)} title={o.remove} aria-label={o.remove} className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
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
                  <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-md bg-ebios-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-ebios-700 disabled:opacity-50">
                    <Plus size={15} /> {o.addMember}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>

        {/* Mode des échelles de risque : communes (groupe) ou par organisation (consultant) */}
        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-1 font-semibold text-gray-800">{o.scalesTitle}</h2>
          <p className="mb-3 text-xs text-gray-500">{o.scalesNote}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ['SHARED', o.scalesShared, o.scalesSharedDesc],
              ['PER_ORG', o.scalesPerOrg, o.scalesPerOrgDesc],
            ] as const).map(([val, label, desc]) => (
              <label key={val} className={`flex cursor-pointer gap-3 rounded-md border p-3 text-sm ${scalesScope === val ? 'border-ebios-400 bg-ebios-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" name="scalesScope" checked={scalesScope === val} onChange={() => changeScalesScope(val)} className="mt-0.5 accent-ebios-600" />
                <span>
                  <span className="block font-medium text-gray-800">{label}</span>
                  <span className="block text-xs text-gray-500">{desc}</span>
                </span>
              </label>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
