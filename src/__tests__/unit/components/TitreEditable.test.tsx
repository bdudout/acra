import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TitreEditable from '@/components/TitreEditable'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
const labels = { renommer: 'Renommer l’analyse', nom: 'Nom de l’analyse', enregistrer: 'Enregistrer le nom', annuler: 'Annuler', erreur: 'Renommage impossible.' }
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); refresh.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('TitreEditable', () => {
  it('crayon → champ ; Entrée enregistre (PATCH nom) et rafraîchit la page ; Échap annule', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
    render(<TitreEditable analyseId="a1" nom="Cyber — paie" canEdit labels={labels} />)
    fireEvent.click(screen.getByRole('button', { name: 'Renommer l’analyse' }))
    const input = screen.getByLabelText('Nom de l’analyse')
    fireEvent.change(input, { target: { value: 'Cyber — paie 2027' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Cyber — paie 2027' })).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledWith('/api/analyses/a1', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ nom: 'Cyber — paie 2027' }) }))
    expect(refresh).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Renommer l’analyse' }))
    fireEvent.keyDown(screen.getByLabelText('Nom de l’analyse'), { key: 'Escape' })
    expect(screen.queryByLabelText('Nom de l’analyse')).toBeNull()
  })
  it('sans droit : pas de crayon ; échec : message', async () => {
    const { unmount } = render(<TitreEditable analyseId="a1" nom="X" canEdit={false} labels={labels} />)
    expect(screen.queryByRole('button', { name: 'Renommer l’analyse' })).toBeNull()
    unmount()
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })
    render(<TitreEditable analyseId="a1" nom="X" canEdit labels={labels} />)
    fireEvent.click(screen.getByRole('button', { name: 'Renommer l’analyse' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le nom' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})
