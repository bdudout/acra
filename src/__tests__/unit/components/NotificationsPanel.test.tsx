import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import NotificationsPanel, { type HorlogeRegimeJson } from '@/components/NotificationsPanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const horloges: HorlogeRegimeJson[] = [
  { regime: 'NIS2', labelKey: 'notifRegimes.NIS2.label', phases: [
    { code: 'ALERTE_PRECOCE', labelKey: 'notifRegimes.NIS2.phases.ALERTE_PRECOCE', echeance: '2026-09-30T08:00:00.000Z', statut: 'SOUMIS', soumisLe: '2026-09-29T20:00:00.000Z', reference: 'ANSSI-1', tardive: false },
    { code: 'NOTIFICATION', labelKey: 'notifRegimes.NIS2.phases.NOTIFICATION', echeance: '2026-10-02T08:00:00.000Z', statut: 'EN_RETARD', soumisLe: null, tardive: false },
    { code: 'RAPPORT_FINAL', labelKey: 'notifRegimes.NIS2.phases.RAPPORT_FINAL', echeance: null, statut: 'EN_ATTENTE', soumisLe: null, tardive: false },
  ] },
  { regime: 'CLIENT_X', label: 'Client X (contrat)', phases: [{ code: 'PREVENIR', label: 'Prévenir le client', echeance: '2026-09-29T10:00:00.000Z', statut: 'A_FAIRE', soumisLe: null, tardive: false }] },
]

describe('NotificationsPanel', () => {
  it('affiche tous les régimes applicables, libellés officiels et personnalisés, statuts et échéances', () => {
    render(<NotificationsPanel horloges={horloges} canQualify busy={false} onMark={() => {}} onUnmark={() => {}} />)
    expect(screen.getByText('NIS2 — Directive (UE) 2022/2555, art. 23')).toBeTruthy()
    expect(screen.getByText('Client X (contrat)')).toBeTruthy()
    expect(screen.getByText('Alerte précoce')).toBeTruthy()
    expect(screen.getByText('Notification d’incident')).toBeTruthy()
    expect(screen.getByText('En retard')).toBeTruthy()
    expect(screen.getByText('En attente')).toBeTruthy()
    expect(screen.getByText(/ANSSI-1/)).toBeTruthy()
    expect(screen.getByText(/ne transmet rien/)).toBeTruthy()
  })
  it('marque une phase soumise avec une référence ; annule une soumission', () => {
    const onMark = vi.fn(); const onUnmark = vi.fn()
    render(<NotificationsPanel horloges={horloges} canQualify busy={false} onMark={onMark} onUnmark={onUnmark} />)
    const ligne = screen.getByText('Notification d’incident').closest('li')!
    fireEvent.change(within(ligne).getByLabelText('Référence de l’accusé (facultatif)'), { target: { value: 'REF-9' } })
    fireEvent.click(within(ligne).getByRole('button', { name: 'Marquer comme soumise' }))
    expect(onMark).toHaveBeenCalledWith('NIS2', 'NOTIFICATION', 'REF-9')
    fireEvent.click(within(screen.getByText('Alerte précoce').closest('li')!).getByRole('button', { name: 'Annuler la soumission' }))
    expect(onUnmark).toHaveBeenCalledWith('NIS2', 'ALERTE_PRECOCE')
  })
  it('sans droit de qualification : lecture seule ; sans régime applicable : message', () => {
    const { rerender } = render(<NotificationsPanel horloges={horloges} canQualify={false} busy={false} onMark={() => {}} onUnmark={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Marquer comme soumise' })).toBeNull()
    rerender(<NotificationsPanel horloges={[]} canQualify busy={false} onMark={() => {}} onUnmark={() => {}} />)
    expect(screen.getByText(/Aucune obligation applicable/)).toBeTruthy()
  })
})
