// Rétention du journal d'audit : affichage de la durée et des purges archivées ; enregistrement ; durée hors bornes refusée.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RetentionJournal from '@/components/RetentionJournal'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const etat = { retentionMois: 60, min: 12, max: 240, purges: [{ id: 'p1', nb: 1500, jusquaSeq: '1500', avant: '2021-11-03T00:00:00Z', archiveCle: 'audit-archives/journal-1-1500-2026-11-03.jsonl.gz', archiveSha256: 'a'.repeat(64), createdAt: '2026-11-03T03:00:00Z' }] }
const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (_u: string, init?: RequestInit) => (init?.method === 'PUT'
    ? (JSON.parse(String(init.body)).retentionMois === 6 ? { ok: false, json: async () => ({ error: 'retention_hors_bornes' }) } : { ok: true, json: async () => ({}) })
    : { ok: true, json: async () => etat }))
  vi.stubGlobal('fetch', fetchMock)
})

describe('RetentionJournal', () => {
  it('affiche la durée et les purges archivées', async () => {
    render(<RetentionJournal />)
    expect(await screen.findByText('Conservation actuelle : 60 mois.')).toBeInTheDocument()
    expect(screen.getByText('audit-archives/journal-1-1500-2026-11-03.jsonl.gz')).toBeInTheDocument()
  })
  it('enregistre une durée ; refuse une durée hors bornes', async () => {
    render(<RetentionJournal />)
    const champ = await screen.findByLabelText('Durée de conservation en mois')
    fireEvent.change(champ, { target: { value: '120' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Rétention enregistrée.')
    expect(JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PUT')![1].body)).toEqual({ retentionMois: 120 })
    fireEvent.change(champ, { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('entre 12 et 240'))
  })
})
