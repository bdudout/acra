import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RapportsGabaritsEditor from '@/components/RapportsGabaritsEditor'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('RapportsGabaritsEditor', () => {
  it('masqué pour un non-ADMIN', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ canEdit: false, config: { gabarits: {} } }) })
    const { container } = render(<RapportsGabaritsEditor codes={['R-INC-1']} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })
  it('ADMIN : saisit titre, introduction et sections masquées puis enregistre', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ canEdit: true, config: { gabarits: {} } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ config: { gabarits: { 'R-INC-1': { titre: 'Revue' } } } }) })
    render(<RapportsGabaritsEditor codes={['R-INC-1']} />)
    fireEvent.change(await screen.findByLabelText('Titre personnalisé'), { target: { value: 'Revue' } })
    fireEvent.change(screen.getByLabelText(/Sections à masquer/), { target: { value: 'parType, parMois' } })
    fireEvent.change(screen.getByLabelText(/Génération automatique/), { target: { value: 'MENSUEL' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les gabarits' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Gabarits enregistrés.'))
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ gabarits: { 'R-INC-1': { titre: 'Revue', sectionsMasquees: ['parType', 'parMois'] } }, planifies: [{ code: 'R-INC-1', frequence: 'MENSUEL' }] })
  })
})
