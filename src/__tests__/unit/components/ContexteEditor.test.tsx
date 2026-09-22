import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ContexteEditor from '@/components/ContexteEditor'

const labels = {
  perimetreLabel: 'Périmètre', objectifsLabel: 'Objectifs / critères',
  perimetrePlaceholder: 'Décrivez le périmètre…', objectifsPlaceholder: 'Objectifs et critères…',
  save: 'Enregistrer le contexte', saved: 'Contexte enregistré',
}
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); fetchMock.mockResolvedValue({ ok: true, json: async () => ({ contexte: {} }) } as Response); vi.stubGlobal('fetch', fetchMock) })

describe('ContexteEditor', () => {
  it('initialise les champs avec les valeurs fournies', () => {
    render(<ContexteEditor analyseId="an1" perimetre="SI prod" objectifs="Confidentialité" {...labels} />)
    expect((screen.getByLabelText('Périmètre') as HTMLTextAreaElement).value).toBe('SI prod')
    expect((screen.getByLabelText('Objectifs / critères') as HTMLTextAreaElement).value).toBe('Confidentialité')
  })

  it('enregistre via PATCH le contexte saisi puis affiche l’état « enregistré »', async () => {
    render(<ContexteEditor analyseId="an1" perimetre="" objectifs="" {...labels} />)
    fireEvent.change(screen.getByLabelText('Périmètre'), { target: { value: 'Nouveau périmètre' } })
    fireEvent.change(screen.getByLabelText('Objectifs / critères'), { target: { value: 'Nouveaux objectifs' } })
    fireEvent.click(screen.getByText('Enregistrer le contexte'))

    await waitFor(() => expect(screen.getByText('Contexte enregistré')).toBeInTheDocument())
    const call = fetchMock.mock.calls.find(c => c[1]?.method === 'PATCH')
    expect(call?.[0]).toBe('/api/analyses/an1/contexte')
    expect(JSON.parse(call![1].body)).toEqual({ perimetre: 'Nouveau périmètre', objectifsEtude: 'Nouveaux objectifs' })
  })

  it('bouton désactivé tant qu’aucune modification n’est faite', () => {
    render(<ContexteEditor analyseId="an1" perimetre="A" objectifs="B" {...labels} />)
    expect((screen.getByText('Enregistrer le contexte') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Périmètre'), { target: { value: 'A2' } })
    expect((screen.getByText('Enregistrer le contexte') as HTMLButtonElement).disabled).toBe(false)
  })
})
