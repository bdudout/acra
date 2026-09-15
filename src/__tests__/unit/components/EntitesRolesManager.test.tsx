import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EntitesRolesManager from '@/components/EntitesRolesManager'

vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({
    t: {
      entites: {
        title: 'Entités', subtitle: 'sub', addTitle: 'Ajouter', nomLabel: 'Nom', nomPh: 'ph',
        parentLabel: 'Parent', addBtn: 'Créer', adding: '…', treeTitle: 'Arbre', rootBadge: 'Org',
        membresN: '{n} m', analysesN: '{n} a', membresTitle: 'Membres de « {nom} »',
        selectEntite: 'Sélectionnez', emailLabel: 'Email', emailPh: 'ph', roleLabel: 'Rôle',
        scopeLabel: 'Portée', scopeNode: 'Nœud', scopeSubtree: 'Sous-arbre', addMember: 'Ajouter',
        noMembers: 'Aucun membre', remove: 'Retirer', removeConfirm: 'Sûr ?',
        tpeNote: 'note', tpeNoteLink: 'lien', error: 'err', loading: '…',
      },
    },
  }),
}))

const ORG = 'org1'
const base = `/api/organizations/${ORG}/entites`

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  return vi.fn((url: string, init?: RequestInit) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(handler(url, init)) } as Response))
}

describe('EntitesRolesManager', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('affiche l\'arborescence, charge les membres à la sélection et ajoute un membre sur la bonne entité', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url, init })
      let body: unknown = {}
      if (url === base && (!init || init.method === undefined)) {
        body = { entites: [
          { id: 'org1', nom: 'Mon Org', parentId: null, actif: true, depth: 0, isRoot: true, membres: 1, analyses: 0 },
          { id: 'dirA', nom: 'Direction A', parentId: 'org1', actif: true, depth: 1, isRoot: false, membres: 2, analyses: 3 },
        ] }
      } else if (url === `${base}/dirA/membres` && (!init || init.method === undefined)) {
        body = { members: [{ id: 'm1', role: 'RSSI', scope: 'NODE', user: { id: 'u1', name: 'Alice', email: 'alice@x.fr' } }] }
      } else if (url === `${base}/dirA/membres` && init?.method === 'POST') {
        body = { membership: { id: 'm2' } }
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<EntitesRolesManager orgId={ORG} />)

    // Arborescence chargée (boutons de l'arbre — le nom apparaît aussi dans le select parent)
    expect(await screen.findByRole('button', { name: /Mon Org/ })).toBeInTheDocument()

    // Sélection de la sous-entité → chargement de ses membres
    fireEvent.click(screen.getByRole('button', { name: /Direction A/ }))
    expect(await screen.findByText('Alice')).toBeInTheDocument()

    // Ajout d'un membre → POST sur /entites/dirA/membres (input de type email)
    const emailInput = screen.getAllByPlaceholderText('ph').find(el => (el as HTMLInputElement).type === 'email')!
    fireEvent.change(emailInput, { target: { value: 'bob@x.fr' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    await waitFor(() => {
      const post = calls.find(c => c.url === `${base}/dirA/membres` && c.init?.method === 'POST')
      expect(post).toBeTruthy()
      expect(JSON.parse(post!.init!.body as string)).toMatchObject({ email: 'bob@x.fr', role: 'ANALYSTE', scope: 'NODE' })
    })
  })

  it('crée une entité via POST sur la racine des entités', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url, init })
      const body = url === base && (!init || init.method === undefined)
        ? { entites: [{ id: 'org1', nom: 'Mon Org', parentId: null, actif: true, depth: 0, isRoot: true, membres: 0, analyses: 0 }] }
        : {}
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<EntitesRolesManager orgId={ORG} />)
    await screen.findByRole('button', { name: /Mon Org/ })

    // Sans sélection, seul le champ « nom » porte le placeholder 'ph'.
    fireEvent.change(screen.getByPlaceholderText('ph'), { target: { value: 'Filiale X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() => {
      const post = calls.find(c => c.url === base && c.init?.method === 'POST')
      expect(post).toBeTruthy()
      expect(JSON.parse(post!.init!.body as string)).toMatchObject({ nom: 'Filiale X' })
    })
  })
})
