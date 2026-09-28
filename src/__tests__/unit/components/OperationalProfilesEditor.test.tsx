import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import OperationalProfilesEditor from '@/components/OperationalProfilesEditor'

describe('OperationalProfilesEditor', () => {
  it('envoie le profil complet lorsque la cible est modifiée', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    render(<OperationalProfilesEditor canManage profiles={[{
      framework: 'NIST_CSF_2_0', catalog: { title: 'NIST CSF', version: '2.0', sourceUrl: '#', items: [{ ref: 'GV', label: 'Govern', description: 'Gouvernance' }] },
      entries: [{ ref: 'GV', statut: 'PARTIEL', cible: 'COUVERT' }],
    }]} labels={{ current: 'État courant', target: 'Cible', save: 'Enregistrer', saved: 'Enregistré', noAssessment: 'Non évalué', createAction: 'Créer une action', actionCreated: 'Action créée' }} />)
    fireEvent.change(screen.getByLabelText('GV cible'), { target: { value: 'NON_COUVERT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/operational-profiles', expect.objectContaining({ method: 'PUT' }))
    await vi.waitFor(() => expect(fetchMock.mock.calls[0][1].body).toContain('NON_COUVERT'))
  })

  it('propose la création d’une action uniquement pour un écart actionnable', () => {
    render(<OperationalProfilesEditor canManage profiles={[{
      framework: 'NIST_CSF_2_0', catalog: { title: 'NIST CSF', version: '2.0', sourceUrl: '#', items: [{ ref: 'GV', label: 'Govern', description: 'Gouvernance' }] },
      entries: [{ ref: 'GV', statut: 'NON_COUVERT' }],
    }]} labels={{ current: 'État courant', target: 'Cible', save: 'Enregistrer', saved: 'Enregistré', noAssessment: 'Non évalué', createAction: 'Créer une action', actionCreated: 'Action créée' }} />)
    expect(screen.getByRole('button', { name: 'Créer une action' })).toBeInTheDocument()
  })
})
