import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import OrganizationsAdminPage from '@/app/admin/organizations/page'

vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { role: 'SUPER_ADMIN' } }, status: 'authenticated' }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('@/components/Navbar', () => ({ default: () => null }))
vi.mock('@/components/AdminNav', () => ({ default: () => null }))
vi.mock('@/components/OrgLogo', () => ({ default: () => null }))
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: { admin: { org: {
    title: 'Organisations', subtitle: 'Sous-titre', create: 'Créer', name: 'Nom', parent: 'Parent', noParent: 'Racine', rootBadge: 'Racine',
    members: 'Membres', addMember: 'Ajouter', email: 'E-mail', role: 'Rôle', scope: 'Portée', scopeNode: 'Nœud', scopeSubtree: 'Sous-arbre',
    remove: 'Retirer', analyses: 'analyses', empty: 'Vide', selectHint: 'Sélectionnez', removeConfirm: 'Confirmer',
    scalesTitle: 'Échelles', scalesShared: 'Communes', scalesSharedDesc: 'desc', scalesPerOrg: 'Par org', scalesPerOrgDesc: 'desc', scalesNote: 'note',
    logoChange: 'Logo', logoReset: 'Réinitialiser', editTitle: 'Modifier', save: 'Enregistrer', parentHint: 'hint',
    delete: 'Supprimer', deleteHint: 'delete hint', deleteConfirm: 'Supprimer définitivement ?',
  } } } }),
}))

const organizations = [
  { id: 'root', nom: 'Groupe', slug: 'groupe', parentId: null, path: '/root/', actif: true, _count: { membres: 0, analyses: 0 } },
  { id: 'child', nom: 'Filiale fautive', slug: 'filiale', parentId: 'root', path: '/root/child/', actif: true, _count: { membres: 0, analyses: 0 } },
]

describe('OrganizationsAdminPage', () => {
  it('permet de renommer et déplacer l’organisation sélectionnée', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url, init })
      const body = url === '/api/admin/organizations' ? { organizations } : url === '/api/admin/scales-scope' ? { scalesScope: 'SHARED' } : { members: [] }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response)
    }))
    render(<OrganizationsAdminPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Filiale fautive/ }))
    const name = await screen.findByLabelText('Nom')
    fireEvent.change(name, { target: { value: 'Filiale corrigée' } })
    fireEvent.change(screen.getByLabelText('Parent'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      const patch = calls.find(call => call.url === '/api/admin/organizations/child' && call.init?.method === 'PATCH')
      expect(patch).toBeTruthy()
      expect(JSON.parse(patch!.init!.body as string)).toEqual({ nom: 'Filiale corrigée', parentId: null })
    })
  })
})
