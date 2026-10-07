import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ImportServicesTiers from '@/components/tiers/ImportServicesTiers'
import EntiteLiens from '@/components/tiers/EntiteLiens'
import type { ServiceTiers } from '@/lib/services-tiers'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const sv = (key: string, nom: string, o: Partial<ServiceTiers> = {}): ServiceTiers => ({
  key, nom, type: 'PRESTATAIRE', partieIds: [`${key}-1`], analyses: [{ id: 'a1', nom: 'Analyse 1' }], tierIds: [], aRattacher: [`${key}-1`], parEntite: {}, candidats: [], ...o,
})

describe('ImportServicesTiers', () => {
  it('propose les services tiers sans entité : rattacher à la candidate ou créer l’entité', () => {
    const onRattacher = vi.fn(), onCreer = vi.fn()
    const ovh = sv('ovh', 'OVH', { candidats: [{ tierId: 't2', nom: 'OVHcloud', reason: 'ALIAS' }] })
    render(<ImportServicesTiers services={[ovh, sv('acme', 'Acme'), sv('lie', 'Déjà lié', { aRattacher: [], tierIds: ['t1'] })]} canManage busy={false} onRattacher={onRattacher} onCreer={onCreer} />)
    expect(screen.getByText(/2 service\(s\) tiers/)).toBeTruthy()
    expect(screen.queryByText('Déjà lié')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Rattacher à « OVHcloud »' }))
    expect(onRattacher).toHaveBeenCalledWith(['ovh-1'], 't2')
    const acme = screen.getByText('Acme').closest('li')!
    fireEvent.click(within(acme).getByRole('button', { name: 'Créer l’entité' }))
    expect(onCreer).toHaveBeenCalledWith(expect.objectContaining({ key: 'acme' }))
  })
  it('ne propose que les fournisseurs, prestataires et partenaires (pas les clients ni les acteurs internes)', () => {
    render(<ImportServicesTiers services={[sv('assures', 'Assurés', { type: 'CLIENT' }), sv('acpr', 'ACPR', { type: 'ORGANISME_REGULATION' }), sv('ovh', 'OVH', { type: 'FOURNISSEUR' }), sv('p', 'Partenaire X', { type: 'PARTENAIRE' })]} canManage busy={false} onRattacher={vi.fn()} onCreer={vi.fn()} />)
    expect(screen.queryByText('Assurés')).toBeNull()
    expect(screen.queryByText('ACPR')).toBeNull()
    expect(screen.getByText('OVH')).toBeTruthy()
    expect(screen.getByText('Partenaire X')).toBeTruthy()
    expect(screen.getByText(/2 service\(s\) tiers/)).toBeTruthy()
  })
})

describe('EntiteLiens', () => {
  const services = [
    sv('ovh', 'OVH', { tierIds: ['t2'], aRattacher: [], parEntite: { t2: ['ovh-1'] } }),
    sv('mail', 'OVH Mail'),
  ]
  it('graphe services ↔ entité ↔ contrats, rattacher / détacher un service, associer un contrat', () => {
    const onRattacher = vi.fn(), onContrat = vi.fn()
    render(<EntiteLiens tier={{ id: 't2', nom: 'OVHcloud' }} services={services} contrats={[{ id: 'c1', reference: 'TIC-01' }]} contratsLibres={[{ id: 'c2', reference: 'TIC-02', prestataireNom: 'OVH SAS' }]} canManage busy={false} onRattacher={onRattacher} onContrat={onContrat} />)
    const graphe = screen.getByRole('img', { name: /Liens de l’entité/ })
    expect(within(graphe).getAllByText('OVH').length).toBeGreaterThan(0)
    expect(within(graphe).getAllByText('TIC-01').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Détacher — OVH' }))
    expect(onRattacher).toHaveBeenCalledWith(['ovh-1'], null)
    fireEvent.change(screen.getByLabelText('Rattacher un service tiers'), { target: { value: 'mail' } })
    expect(onRattacher).toHaveBeenLastCalledWith(['mail-1'], 't2')
    fireEvent.change(screen.getByLabelText('Associer un contrat'), { target: { value: 'c2' } })
    expect(onContrat).toHaveBeenCalledWith('c2', 't2')
    fireEvent.click(screen.getByRole('button', { name: 'Détacher — TIC-01' }))
    expect(onContrat).toHaveBeenLastCalledWith('c1', null)
  })
  it('lecture seule : ni rattachement ni détachement', () => {
    render(<EntiteLiens tier={{ id: 't2', nom: 'OVHcloud' }} services={services} contrats={[]} contratsLibres={[]} canManage={false} busy={false} onRattacher={vi.fn()} onContrat={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Détacher/ })).toBeNull()
    expect(screen.queryByLabelText('Rattacher un service tiers')).toBeNull()
  })
})
