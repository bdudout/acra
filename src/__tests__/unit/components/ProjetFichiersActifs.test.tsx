import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FichiersProjet from '@/components/projet360/FichiersProjet'
import ActifsProjet from '@/components/projet360/ActifsProjet'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const fetchMock = vi.fn()
const ok = (b: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => b } as Response)
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('FichiersProjet (phase 1)', () => {
  it('liste les fichiers (téléchargement), dépose un schéma, supprime', async () => {
    const liste = [{ id: 'd1', titre: 'Schéma réseau', type: 'SCHEMA', fichierNom: 'reseau.png', mime: 'image/png', taille: 2048, createdAt: '2026-10-06' }]
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return ok({ fichier: { id: 'd2', titre: 'Dossier', type: 'ARCHITECTURE', fichierNom: 'dat.pdf', mime: 'application/pdf', taille: 10, createdAt: '2026-10-06' } }, 201)
      if (init?.method === 'DELETE') return ok({ ok: true })
      return ok({ fichiers: liste })
    })
    render(<FichiersProjet analyseId="p" editable />)
    expect(screen.getByRole('heading', { name: 'Documents du projet' })).toBeTruthy()
    const lien = await screen.findByRole('link', { name: /Schéma réseau/ })
    expect(lien.getAttribute('href')).toBe('/api/analyses/p/fichiers/d1')
    fireEvent.change(screen.getByLabelText('Nature du document'), { target: { value: 'ARCHITECTURE' } })
    fireEvent.change(screen.getByLabelText('Fichier'), { target: { files: [new File(['%PDF'], 'dat.pdf', { type: 'application/pdf' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter le document' }))
    expect(await screen.findByRole('link', { name: /Dossier/ })).toBeTruthy()
    const post = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')!
    expect(post[0]).toBe('/api/analyses/p/fichiers')
    expect((post[1].body as FormData).get('type')).toBe('ARCHITECTURE')
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer — Schéma réseau' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: /Schéma réseau/ })).toBeNull())
  })
  it('lecture seule : pas de dépôt ni de suppression', async () => {
    fetchMock.mockImplementation(() => ok({ fichiers: [] }))
    render(<FichiersProjet analyseId="p" editable={false} />)
    expect(await screen.findByText(/Aucun document/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Ajouter le document' })).toBeNull()
  })
})

describe('ActifsProjet (phase 2)', () => {
  it('saisit données et services avec leur criticité, enregistre', async () => {
    fetchMock.mockImplementation((_u: string, init?: RequestInit) => ok(init?.method === 'PUT' ? { actifs: JSON.parse(String(init.body)).actifs } : { actifs: [] }))
    render(<ActifsProjet analyseId="p" editable />)
    expect(await screen.findByRole('heading', { name: 'Données et services du projet' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une ligne' }))
    const ligne = screen.getAllByRole('row')[1]
    fireEvent.change(within(ligne).getByLabelText('Intitulé'), { target: { value: 'Dossiers clients' } })
    fireEvent.change(within(ligne).getByLabelText('Nature'), { target: { value: 'DONNEE' } })
    fireEvent.change(within(ligne).getByLabelText('Criticité'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le tableau' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(c => c[1]?.method === 'PUT')).toBe(true))
    const body = JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PUT')![1].body)
    expect(body.actifs).toEqual([expect.objectContaining({ nom: 'Dossiers clients', type: 'DONNEE', criticite: 4 })])
    expect(await screen.findByText('Tableau enregistré.')).toBeTruthy()
  })
  it('importe les valeurs métier d’une analyse cyber trouvée par recherche', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return ok({ actifs: [{ id: 'a', nom: 'Données clients', type: 'DONNEE', criticite: 4, source: 'Cyber — portail' }], ajoutes: 1 })
      if (url.includes('/import-cyber')) return ok({ sources: [{ id: 's', nom: 'Cyber — portail', methode: 'EBIOS_RM' }] })
      return ok({ actifs: [] })
    })
    render(<ActifsProjet analyseId="p" editable />)
    fireEvent.change(await screen.findByLabelText('Rechercher une analyse cyber'), { target: { value: 'portail' } })
    fireEvent.change(await screen.findByLabelText('Analyse cyber source'), { target: { value: 's' } })
    fireEvent.click(screen.getByRole('button', { name: 'Importer ses valeurs métier' }))
    expect(await screen.findByDisplayValue('Données clients')).toBeTruthy()
    expect(JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'POST')![1].body)).toEqual({ sourceAnalyseId: 's' })
    expect(screen.getByText('1 ligne(s) importée(s).')).toBeTruthy()
  })
})
