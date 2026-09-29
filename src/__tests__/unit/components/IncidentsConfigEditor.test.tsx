import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import IncidentsConfigEditor from '@/components/IncidentsConfigEditor'
import { resolveIncidentsConfig } from '@/lib/incidents-config'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

describe('IncidentsConfigEditor', () => {
  it('active un régime livré, surcharge un délai, fixe les seuils et enregistre la configuration', () => {
    const onSave = vi.fn()
    render(<IncidentsConfigEditor config={resolveIncidentsConfig(undefined)} onSave={onSave} busy={false} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /NIS2 — Directive \(UE\) 2022\/2555, art\. 23 — Actif/ }))
    fireEvent.change(screen.getByLabelText('Alerte précoce — Délai (h)'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('Seuil de collecte (perte nette minimale)'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Devise de référence'), { target: { value: 'usd' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    const raw = onSave.mock.calls[0][0]
    expect(raw.deviseReference).toBe('USD')
    expect(raw.seuilCollecte).toBe(1000)
    expect(raw.regimes.find((r: { code: string }) => r.code === 'NIS2')).toMatchObject({ actif: true, phases: expect.arrayContaining([{ code: 'ALERTE_PRECOCE', delaiH: 12 }]) })
  })
  it('ajoute un régime personnalisé (contractuel client) sans code', () => {
    const onSave = vi.fn()
    render(<IncidentsConfigEditor config={resolveIncidentsConfig(undefined)} onSave={onSave} busy={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un régime personnalisé' }))
    fireEvent.change(screen.getByLabelText('Nom du régime'), { target: { value: 'Contrat client X' } })
    fireEvent.change(screen.getByLabelText('Nom de la phase'), { target: { value: 'Prévenir le client' } })
    fireEvent.change(screen.getByLabelText('Délai de la phase (h)'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider le régime' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    const custom = onSave.mock.calls[0][0].regimes.find((r: { label?: string }) => r.label === 'Contrat client X')
    expect(custom).toMatchObject({ actif: true, declencheur: 'MANUEL' })
    expect(custom.phases[0]).toMatchObject({ label: 'Prévenir le client', delaiH: 2, apres: 'CONNAISSANCE' })
  })
  it('désactive un type d’événement du catalogue', () => {
    const onSave = vi.fn()
    render(<IncidentsConfigEditor config={resolveIncidentsConfig(undefined)} onSave={onSave} busy={false} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fraude — Actif' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(onSave.mock.calls[0][0].typesEvenement).toContainEqual({ code: 'FRAUDE', actif: false })
  })
})
