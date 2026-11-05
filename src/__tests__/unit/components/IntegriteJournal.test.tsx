// Intégrité du journal d'audit : vérification à la demande, résultat intègre / rupture localisée, alerte sans clé.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import IntegriteJournal from '@/components/IntegriteJournal'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const repond = (corps: object) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => corps })))

describe('IntegriteJournal', () => {
  it('chaîne intègre', async () => {
    repond({ ok: true, verifiees: 1200, nonScellees: 3, horsOrdre: 0, rupture: null, dernier: { seq: '1200', createdAt: '2026-11-03T08:00:00Z' }, cleConfiguree: true })
    render(<IntegriteJournal />)
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier l’intégrité' }))
    expect(await screen.findByText(/Chaîne intègre/)).toBeInTheDocument()
    expect(screen.getByText('3 entrée(s) récente(s) en attente de scellement.')).toBeInTheDocument()
    expect(screen.queryByText(/Aucune clé de chaînage/)).toBeNull()
  })
  it('rupture localisée et alerte sans clé', async () => {
    repond({ ok: false, verifiees: 41, nonScellees: 0, horsOrdre: 0, rupture: { seq: '42', raison: 'contenu_modifie' }, dernier: null, cleConfiguree: false })
    render(<IntegriteJournal />)
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier l’intégrité' }))
    expect(await screen.findByText(/Rupture détectée à l’entrée n° 42 : contenu modifié/)).toBeInTheDocument()
    expect(screen.getByText(/Aucune clé de chaînage/)).toBeInTheDocument()
  })
})
