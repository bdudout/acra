/**
 * n° 43 : après l'ajout d'un plan d'action à un risque (phase Traitement), le compteur de la
 * ligne du risque et l'avertissement « Réduire sans mesure ni plan » se mettent à jour tout de
 * suite — RiskPlans / RiskMesures signalent leur nombre d'éléments au parent (onCount).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RiskPlans from '@/components/RiskPlans'
import RiskMesures from '@/components/RiskMesures'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
const json = (d: unknown) => Promise.resolve({ ok: true, json: async () => d })

describe('RiskPlans — onCount', () => {
  it('signale le nombre chargé, puis le nouveau nombre après un ajout', async () => {
    let plans: { id: string; titre: string; statut: string; priorite: string }[] = []
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') { plans = [{ id: 'p1', titre: 'Chiffrer', statut: 'A_FAIRE', priorite: 'MAJEUR' }]; return json({ id: 'p1' }) }
      return json({ plans })
    })
    const onCount = vi.fn()
    render(<RiskPlans analyseId="a1" riskId="r1" editable onCount={onCount} />)
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(0))
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Chiffrer' } })
    fireEvent.click(screen.getByRole('button', { name: /Ajouter/ }))
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(1))
  })
  it('aucun signalement avant la fin du chargement (pas de 0 transitoire)', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const onCount = vi.fn()
    render(<RiskPlans analyseId="a1" riskId="r1" editable onCount={onCount} />)
    expect(onCount).not.toHaveBeenCalled()
  })
})

describe('RiskMesures — onCount', () => {
  it('signale le nombre de mesures chargées', async () => {
    fetchMock.mockImplementation(() => json({ mesures: [{ id: 'm1', nom: 'MFA', efficacite: 3, statut: 'REALISE' }, { id: 'm2', nom: 'EDR', efficacite: 3, statut: 'REALISE' }] }))
    const onCount = vi.fn()
    render(<RiskMesures analyseId="a1" riskId="r1" editable={false} onCount={onCount} />)
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(2))
  })
})
