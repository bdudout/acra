/** Écrans GED et plan d'audit (lot V1) : liste paginée côté serveur, compteurs de la synthèse, menu des contrôles en vue légère. */
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ params: new URLSearchParams(''), replace: vi.fn() }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => nav.params,
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => '/x',
}))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('@/components/usePersonnalisationChamps', () => ({ usePersonnalisationChamps: () => [] }))

import DocumentsManager from '@/components/DocumentsManager'
import AuditManager from '@/components/AuditManager'

const json = (d: unknown) => ({ ok: true, json: async () => d })
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); nav.params = new URLSearchParams(''); vi.stubGlobal('fetch', fetchMock) })

describe('DocumentsManager', () => {
  it('charge la page côté serveur, affiche la barre de pagination et « déjà ajouté » selon la synthèse', async () => {
    nav.params = new URLSearchParams('type=PSSI')
    fetchMock.mockImplementation(async (u: string) => (u.startsWith('/api/documents')
      ? json({ active: true, documents: [{ id: 'd1', titre: 'PSSI groupe', type: 'PSSI', portee: 'ORG', referentielCode: null, risqueId: null, version: null, description: null, dateDocument: null, dateRevue: null, fichierNom: 'pssi.pdf', mime: 'application/pdf', taille: 10, createdAt: '2026-01-01' }],
        pagination: { page: 1, taille: 50, total: 1, pages: 1 }, synthese: { total: 80, titresModeles: [] } })
      : json({})))
    render(<DocumentsManager canManage={false} />)
    expect(await screen.findByText('PSSI groupe')).toBeInTheDocument()
    expect(fetchMock.mock.calls.map(c => c[0])).toContain('/api/documents?type=PSSI&page=1')
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('1 à 1 sur 1')
  })
})

describe('AuditManager', () => {
  it('missions paginées côté serveur, tuiles depuis la synthèse, contrôles via ?vue=options', async () => {
    fetchMock.mockImplementation(async (u: string) => {
      if (u.startsWith('/api/audit/missions')) return json({ active: true, missions: [{ id: 'm1', intitule: 'Revue des accès', objectif: null, perimetre: null, responsable: null, dateDebut: null, dateFin: null, statut: 'EN_COURS', synthese: { total: 0, ouverts: 0, resolus: 0, enRetard: 0, critiques: 0, tauxResolution: 0 }, programme: [], programmeResultats: [], processusIds: [], controleIds: [], type: 'THEMATIQUE', recurrence: 'NONE' }],
        pagination: { page: 1, taille: 50, total: 1, pages: 1 }, synthese: { total: 300, enCours: 7, critiques: 4, enRetard: 2, archivees: 0 } })
      return json({})
    })
    render(<AuditManager canWrite={false} />)
    expect(await screen.findByText('Revue des accès')).toBeInTheDocument()
    const urls = fetchMock.mock.calls.map(c => c[0])
    expect(urls).toContain('/api/audit/missions?page=1')
    expect(urls).toContain('/api/controles?vue=options')
    expect(urls).not.toContain('/api/controles')
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
  })
})
