import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NouveauProjet360 from '@/components/NouveauProjet360'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('@/lib/i18n/use-ebios-data', () => ({ useEbiosData: () => ({ SECTEURS_ACTIVITE: ['Santé', 'Autre'] }) }))
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))

const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); push.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('NouveauProjet360 — page dédiée de lancement', () => {
  it('lance un projet 360 avec ses objectifs, puis ouvre sa qualification', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ analyse: { id: 'n1' } }) })
    render(<NouveauProjet360 maxPatterns={12} />)
    fireEvent.change(screen.getByLabelText('Nom du projet'), { target: { value: 'Migration cloud' } })
    fireEvent.change(screen.getByLabelText('Description / périmètre'), { target: { value: 'Paie et RH' } })
    fireEvent.change(screen.getByLabelText('Objectifs du projet'), { target: { value: 'Bascule sans perte de données' } })
    fireEvent.change(screen.getByLabelText('Date de mise en service (facultative)'), { target: { value: '2027-03-01' } })
    fireEvent.change(screen.getByRole('combobox', { name: /secteur/i }), { target: { value: 'Santé' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /SI standard/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Créer le projet' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/analyses/n1/atelier/1?phase=qualification'))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ nom: 'Migration cloud', description: 'Paie et RH', objectifsEtude: 'Bascule sans perte de données', dateEcheance: '2027-03-01', secteur: 'Santé', patternsArchi: ['SI_STANDARD'], methode: 'PROJET_360' })
  })
  it('ne permet pas de créer sans le secteur et le pattern qui cadrent le projet', () => {
    render(<NouveauProjet360 maxPatterns={12} />)
    fireEvent.change(screen.getByLabelText('Nom du projet'), { target: { value: 'Projet à cadrer' } })
    expect((screen.getByRole('button', { name: 'Créer le projet' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('un exemple de projet préremplit le nom et la description ; lien retour vers les projets', () => {
    render(<NouveauProjet360 maxPatterns={12} />)
    fireEvent.click(screen.getByRole('button', { name: 'Migration vers le cloud' }))
    expect((screen.getByLabelText('Nom du projet') as HTMLInputElement).value).toBe('Migration vers le cloud')
    expect(screen.getByRole('link', { name: '← Retour aux projets' }).getAttribute('href')).toBe('/projets')
  })
})

describe('NouveauProjet360 — depuis une analyse cyber', () => {
  it('le projet créé est lié à l’analyse d’origine', async () => {
    fetchMock.mockImplementation((url: string) => Promise.resolve({ ok: true, status: 201, json: async () => (url === '/api/analyses' ? { analyse: { id: 'n1' } } : { ok: true }) }))
    render(<NouveauProjet360 maxPatterns={12} analyseSourceId="a9" />)
    fireEvent.change(screen.getByLabelText('Nom du projet'), { target: { value: 'Refonte' } })
    fireEvent.change(screen.getByRole('combobox', { name: /secteur/i }), { target: { value: 'Santé' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /SI standard/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Créer le projet' }))
    await waitFor(() => expect(push).toHaveBeenCalled())
    const lien = fetchMock.mock.calls.find(c => c[0] === '/api/projets/n1/analyses')!
    expect(JSON.parse(lien[1].body)).toEqual({ analyseId: 'a9' })
  })
})
