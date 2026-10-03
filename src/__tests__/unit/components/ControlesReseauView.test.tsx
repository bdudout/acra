import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ControlesReseauView from '@/components/ControlesReseauView'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const data = (o: Record<string, unknown> = {}) => ({
  active: true, peutDecliner: true, organisation: 'Mère',
  entites: [{ id: 'f1', nom: 'Filiale 1' }, { id: 'f2', nom: 'Filiale 2' }],
  candidats: [{ id: 'c2', intitule: 'Sauvegardes testées' }],
  references: [{
    id: 'c1', intitule: 'Revue des accès', periodicite: 'TRIMESTRIEL', cle: true,
    cellules: [{ organizationId: 'f1', controleId: 'x', dernierResultat: 'ANOMALIE', derniereExecution: '2026-09-15T00:00:00Z', etat: 'EN_RETARD', taux: 50 }],
    synthese: { entites: 1, conformes: 0, anomalies: 1, enRetard: 1, sansExecution: 0, taux: 50 },
  }],
  ...o,
})
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
const ok = (body: unknown) => ({ ok: true, json: async () => body })

describe('ControlesReseauView', () => {
  it('tableau contrôle × entité : résultat, état, entité non dotée, synthèse', async () => {
    fetchMock.mockResolvedValue(ok(data()))
    render(<ControlesReseauView />)
    expect(await screen.findByText('Revue des accès')).toBeInTheDocument()
    expect(screen.getByText('Filiale 2')).toBeInTheDocument()
    expect(screen.getByText('Anomalie')).toBeInTheDocument()
    expect(screen.getByText('En retard')).toBeInTheDocument()
    expect(screen.getByText('Non décliné')).toBeInTheDocument()
    expect(screen.getByText('50 %')).toBeInTheDocument()
  })
  it('décline un contrôle candidat (POST) puis recharge', async () => {
    fetchMock.mockResolvedValueOnce(ok(data())).mockResolvedValueOnce(ok({ crees: ['f1', 'f2'], ignores: [], dejaDeclinees: 0 })).mockResolvedValue(ok(data()))
    render(<ControlesReseauView />)
    fireEvent.change(await screen.findByLabelText('Décliner un contrôle de l\'organisation'), { target: { value: 'c2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Décliner dans les entités' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/controles/c2/decliner', expect.objectContaining({ method: 'POST' })))
    expect(await screen.findByText(/2 déclinaison\(s\) créée\(s\)/)).toBeInTheDocument()
  })
  it('lecture seule : pas d’action de déclinaison', async () => {
    fetchMock.mockResolvedValue(ok(data({ peutDecliner: false })))
    render(<ControlesReseauView />)
    expect(await screen.findByText(/Consultation seule/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Décliner/ })).toBeNull()
  })
  it('sans entité rattachée : message explicite', async () => {
    fetchMock.mockResolvedValue(ok(data({ entites: [], references: [] })))
    render(<ControlesReseauView />)
    expect(await screen.findByText(/pas d'entité rattachée visible/)).toBeInTheDocument()
  })
})
