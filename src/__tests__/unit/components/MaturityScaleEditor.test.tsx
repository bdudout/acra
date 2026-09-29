import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MaturityScaleEditor from '@/components/config/MaturityScaleEditor'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const fetchMock = vi.fn()
const ok = (b: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => b } as Response)
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('MaturityScaleEditor', () => {
  it('affiche les 6 niveaux CMMI par défaut, surchargés par la personnalisation', async () => {
    fetchMock.mockReturnValueOnce(ok({ echelleMaturite: [{ niveau: 3, libelle: 'Défini groupe', definition: '' }] }))
    render(<MaturityScaleEditor isAdmin />)
    expect(await screen.findByDisplayValue('Défini groupe')).toBeTruthy()
    expect(screen.getByDisplayValue('Géré quantitativement')).toBeTruthy()
    expect(screen.getAllByRole('textbox')).toHaveLength(12)
  })

  it('enregistre uniquement les niveaux modifiés par rapport au défaut', async () => {
    fetchMock.mockReturnValueOnce(ok({ echelleMaturite: [] })).mockReturnValueOnce(ok({}))
    render(<MaturityScaleEditor isAdmin />)
    const field = await screen.findByDisplayValue('Initial')
    fireEvent.change(field, { target: { value: 'Artisanal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('/api/admin/organization-config')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ echelleMaturite: [{ niveau: 1, libelle: 'Artisanal', definition: '' }] })
    expect(await screen.findByText('Échelle enregistrée')).toBeTruthy()
  })

  it('lecture seule hors ADMIN', async () => {
    fetchMock.mockReturnValueOnce(ok({ echelleMaturite: [] }))
    render(<MaturityScaleEditor isAdmin={false} />)
    const field = await screen.findByDisplayValue('Initial')
    expect((field as HTMLInputElement).readOnly).toBe(true)
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull()
  })
})
