import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import ProjectTiers from '@/components/projet360/ProjectTiers'

vi.mock('@/lib/i18n/context', async () => { const { fr } = await import('@/lib/i18n/fr'); return { useTranslation: () => ({ t: fr }) } })
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('ProjectTiers', () => {
  it('propose les tiers existants et les enregistre sans passer par l’atelier EBIOS', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ noms: ['Prestataire déjà contractualisé'] }) })
    fetchMock.mockResolvedValueOnce({ ok: true })
    render(<ProjectTiers analyseId="p1" initial={[]} editable />)
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un tiers' }))
    const input = screen.getByLabelText('Nom du tiers 1') as HTMLInputElement
    // Pas de choix « prestataire / fournisseur / partenaire » : inutile pour un projet.
    expect(document.querySelector('select')).toBeNull()
    fireEvent.change(input, { target: { value: 'Prestataire déjà contractualisé' } })
    await waitFor(() => expect(document.querySelector('#project-known-tiers option')?.getAttribute('value')).toBe('Prestataire déjà contractualisé'))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les tiers' }))
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith('/api/analyses/p1/tiers', expect.objectContaining({ method: 'PUT' })))
  })
})
