/**
 * AutocompleteInput.test.tsx — champ avec datalist alimenté par /api/suggestions.
 *  - Rend la valeur et propage onChange
 *  - Charge les suggestions au focus (une fois) et les rend en <option>
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AutocompleteInput from '@/components/AutocompleteInput'

describe('AutocompleteInput', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('propage la saisie via onChange', () => {
    const onChange = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ suggestions: [] }) }))
    render(<AutocompleteInput field="organisation" value="" onChange={onChange} placeholder="Org" />)
    fireEvent.change(screen.getByPlaceholderText('Org'), { target: { value: 'Ban' } })
    expect(onChange).toHaveBeenCalledWith('Ban')
  })

  it('charge les suggestions au focus (une seule fois) et les rend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ suggestions: ['Banque Populaire', 'Crédit Agricole'] }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<AutocompleteInput field="organisation" value="" onChange={() => {}} placeholder="Org" />)
    const input = screen.getByPlaceholderText('Org')
    fireEvent.focus(input)
    fireEvent.focus(input) // 2e focus : ne doit pas refetch
    await waitFor(() => expect(document.querySelectorAll('datalist option')).toHaveLength(2))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/suggestions?field=organisation')
  })
})
