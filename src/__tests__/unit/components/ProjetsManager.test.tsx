import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProjetsManager from '@/components/ProjetsManager'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('@/lib/i18n/use-ebios-data', () => ({ useEbiosData: () => ({ SECTEURS_ACTIVITE: ['Santé', 'Autre'] }) }))
const push = vi.fn()
const search = { value: '' }
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(search.value) }))

const fetchMock = vi.fn()
beforeEach(() => { search.value = ''; fetchMock.mockReset(); push.mockReset(); vi.stubGlobal('fetch', fetchMock) })

const projets = [{ id: 'p1', nom: 'Refonte portail', statut: 'EN_COURS', risques: 7, updatedAt: '2026-09-20T00:00:00.000Z', analyses: [{ id: 'c1', nom: 'Cyber — portail' }] }]

describe('ProjetsManager', () => {
  it('liste les projets 360 avec statut et nombre de risques', () => {
    render(<ProjetsManager projets={projets} canCreate />)
    expect(screen.getByRole('link', { name: 'Refonte portail' }).getAttribute('href')).toBe('/analyses/p1/atelier/1?phase=qualification')
    expect(screen.getByText('7')).toBeTruthy()
  })

  it('lance un projet 360 (méthode PROJET_360) puis ouvre sa qualification', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ analyse: { id: 'n1' } }) })
    render(<ProjetsManager projets={[]} canCreate />)
    fireEvent.click(screen.getByRole('button', { name: 'Lancer un projet 360' }))
    fireEvent.change(screen.getByLabelText('Nom du projet'), { target: { value: 'Migration cloud' } })
    fireEvent.change(screen.getByLabelText('Description / périmètre'), { target: { value: 'Paie et RH' } })
    fireEvent.change(screen.getByRole('combobox', { name: /secteur/i }), { target: { value: 'Santé' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /SI standard/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Créer le projet' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/analyses/n1/atelier/1?phase=qualification'))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ nom: 'Migration cloud', description: 'Paie et RH', secteur: 'Santé', patternsArchi: ['SI_STANDARD'], methode: 'PROJET_360' })
  })

  it('ne permet pas de créer sans le secteur et le pattern qui cadrent le projet', () => {
    render(<ProjetsManager projets={[]} canCreate />)
    fireEvent.click(screen.getByRole('button', { name: 'Lancer un projet 360' }))
    fireEvent.change(screen.getByLabelText('Nom du projet'), { target: { value: 'Projet à cadrer' } })
    expect((screen.getByRole('button', { name: 'Créer le projet' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('propose de lancer une analyse cyber depuis le projet et liste les analyses déjà rattachées', () => {
    render(<ProjetsManager projets={projets} canCreate />)
    expect(screen.getByRole('link', { name: 'Lancer une analyse cyber' }).getAttribute('href')).toBe('/analyses/new?projet=p1')
    expect(screen.getByRole('link', { name: 'Cyber — portail' }).getAttribute('href')).toBe('/analyses/c1')
  })

  it('un exemple de projet préremplit le nom et la description', () => {
    render(<ProjetsManager projets={[]} canCreate />)
    fireEvent.click(screen.getByRole('button', { name: 'Lancer un projet 360' }))
    fireEvent.click(screen.getByRole('button', { name: 'Migration vers le cloud' }))
    expect((screen.getByLabelText('Nom du projet') as HTMLInputElement).value).toBe('Migration vers le cloud')
    expect((screen.getByLabelText('Description / périmètre') as HTMLTextAreaElement).value.length).toBeGreaterThan(20)
  })

  it('sans droit de création : pas de bouton', () => {
    render(<ProjetsManager projets={[]} canCreate={false} />)
    expect(screen.queryByRole('button', { name: 'Lancer un projet 360' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Lancer une analyse cyber' })).toBeNull()
    expect(screen.getByText('Aucun projet pour le moment.')).toBeTruthy()
  })

  it('?nouveau=1 (menu « Nouveau projet 360 ») : le formulaire de création est déjà ouvert', () => {
    search.value = 'nouveau=1'
    render(<ProjetsManager projets={[]} canCreate />)
    expect(screen.getByLabelText('Nom du projet')).toBeTruthy()
  })
  it('sans ?nouveau=1 ou sans droit de création : formulaire fermé', () => {
    render(<ProjetsManager projets={[]} canCreate />)
    expect(screen.queryByLabelText('Nom du projet')).toBeNull()
    search.value = 'nouveau=1'
    const { container } = render(<ProjetsManager projets={[]} canCreate={false} />)
    expect(container.querySelector('input')).toBeNull()
  })
})
