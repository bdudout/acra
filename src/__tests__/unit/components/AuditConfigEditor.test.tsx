import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuditConfigEditor from '@/components/AuditConfigEditor'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const cfg = { rappelsActifs: true, rappelJoursAvant: 14, rappelRelanceJours: 7, cycles: {} }
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('AuditConfigEditor', () => {
  it('masqué pour un non-ADMIN', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ active: true, canEdit: false, config: cfg }) })
    const { container } = render(<AuditConfigEditor />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })
  it('ADMIN : modifie un cycle et enregistre par PUT', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ active: true, canEdit: true, config: cfg }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ config: { ...cfg, cycles: { 4: 2 } } }) })
    const onSaved = vi.fn()
    render(<AuditConfigEditor onSaved={onSaved} />)
    fireEvent.change(await screen.findByLabelText(/Cycle de couverture.* — 4/), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('/api/audit/config')
    expect(JSON.parse(init.body).cycles).toEqual({ 4: 2 })
    expect(screen.getByRole('status').textContent).toBe('Paramétrage enregistré.')
  })
  it('ADMIN : libellé de notation personnalisé enregistré (vide = libellé par défaut)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ active: true, canEdit: true, config: cfg }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ config: cfg }) })
    render(<AuditConfigEditor />)
    const champ = await screen.findByLabelText('Libellé de la note 2')
    expect(champ).toHaveAttribute('placeholder', 'À améliorer')
    fireEvent.change(champ, { target: { value: 'Maîtrise partielle' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).libellesNotation).toEqual({ 2: 'Maîtrise partielle' })
  })
})
