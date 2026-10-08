// Suivi de l'AIPD d'un traitement (RGPD art. 35-36) : statut, analyse rattachée (analyses de l'organisation), justification
// d'une AIPD non retenue, consultation préalable ; « Créer l'analyse » proposé seulement aux rôles qui le peuvent.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AipdSuiviPanel from '@/components/AipdSuiviPanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
const T = { id: 't1', nom: 'Scoring clients', aipdStatut: null, aipdAnalyseId: null, aipdDate: null, aipdJustification: '', aipdConsultationPrealable: false }

describe('AipdSuiviPanel', () => {
  it('statut, analyse rattachée et date envoyés ; lien de création absent pour le DPO', async () => {
    const fini = vi.fn()
    fetchMock.mockImplementation(async (u: string, init?: { method?: string }) => (u === '/api/analyses' ? { ok: true, json: async () => ({ analyses: [{ id: 'a1', nom: 'AIPD scoring' }] }) } : { ok: true, json: async () => ({ ok: init?.method }) }))
    render(<AipdSuiviPanel traitement={T} peutCreerAnalyse={false} onEnregistre={fini} onAnnuler={() => {}} />)
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'EN_COURS' } })
    await screen.findByRole('option', { name: 'AIPD scoring' })
    fireEvent.change(screen.getByLabelText('Analyse ACRA rattachée'), { target: { value: 'a1' } })
    fireEvent.change(screen.getByLabelText('Date de réalisation'), { target: { value: '2026-10-01' } })
    expect(screen.queryByRole('link', { name: 'Créer l’analyse' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(fini).toHaveBeenCalled())
    const appel = fetchMock.mock.calls.find(c => c[1]?.method === 'PATCH')!
    expect(appel[0]).toBe('/api/ropa/t1/aipd')
    expect(JSON.parse(appel[1].body)).toEqual({ aipdStatut: 'EN_COURS', aipdAnalyseId: 'a1', aipdDate: '2026-10-01', aipdJustification: '', aipdConsultationPrealable: false })
  })
  it('« non retenue » : justification demandée ; refus serveur expliqué ; création d’analyse proposée si autorisé', async () => {
    fetchMock.mockImplementation(async (u: string, init?: { method?: string }) => (u === '/api/analyses' ? { ok: true, json: async () => ({ analyses: [] }) } : init?.method === 'PATCH' ? { ok: false, json: async () => ({ error: 'justification_requise' }) } : { ok: true, json: async () => ({}) }))
    render(<AipdSuiviPanel traitement={T} peutCreerAnalyse onEnregistre={() => {}} onAnnuler={() => {}} />)
    expect(screen.getByRole('link', { name: 'Créer l’analyse' })).toHaveAttribute('href', '/analyses/new')
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'NON_RETENUE' } })
    expect(screen.getByLabelText('Justification de la décision de ne pas réaliser d’AIPD')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/au moins un critère de risque élevé/)
  })
})
