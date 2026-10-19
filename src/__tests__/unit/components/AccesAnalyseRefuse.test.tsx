/**
 * n° 63 : écran « Accès non autorisé » d'une analyse de l'organisation non ouverte au rôle,
 * avec « Demander l'accès » (POST /api/analyses/[id]/demande-acces) et le retour à la liste.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AccesAnalyseRefuse from '@/components/AccesAnalyseRefuse'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

describe('AccesAnalyseRefuse', () => {
  it('explique le refus, nomme l\'analyse et propose de revenir à la liste', () => {
    render(<AccesAnalyseRefuse analyseId="a1" nom="Messagerie des élus 2026" />)
    expect(screen.getByRole('heading', { name: 'Accès non autorisé' })).toBeTruthy()
    expect(screen.getByText(/Messagerie des élus 2026/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Retour aux analyses/ }).getAttribute('href')).toBe('/analyses')
  })
  it('« Demander l\'accès » envoie la demande puis confirme l\'envoi au propriétaire', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, notifie: true }) })
    render(<AccesAnalyseRefuse analyseId="a1" nom="X" />)
    fireEvent.click(screen.getByRole('button', { name: 'Demander l’accès' }))
    expect(await screen.findByText(/Demande envoyée au propriétaire/)).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith('/api/analyses/a1/demande-acces', { method: 'POST' })
    expect(screen.queryByRole('button', { name: 'Demander l’accès' })).toBeNull()
  })
  it('messagerie non configurée : la demande est enregistrée, sans e-mail', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, notifie: false }) })
    render(<AccesAnalyseRefuse analyseId="a1" nom="X" />)
    fireEvent.click(screen.getByRole('button', { name: 'Demander l’accès' }))
    expect(await screen.findByText(/Demande enregistrée/)).toBeTruthy()
  })
  it('échec : message d\'erreur, le bouton reste disponible', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'rate_limited' }) })
    render(<AccesAnalyseRefuse analyseId="a1" nom="X" />)
    fireEvent.click(screen.getByRole('button', { name: 'Demander l’accès' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Demander l’accès' })).toBeTruthy()
  })
})
