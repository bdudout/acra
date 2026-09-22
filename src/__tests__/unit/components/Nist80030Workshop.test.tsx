import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Nist80030Workshop from '@/components/Nist80030Workshop'

const RD = {
  pageTitle: '', pageSubtitle: '', title: 'Risques', subtitle: '', colNom: 'Risque', nomPlaceholder: 'Intitulé',
  colGravite: 'G', colVraisemblance: 'V', colNiveau: 'Niveau', colStrategie: 'Traitement', add: 'Ajouter',
  empty: 'Aucun risque.', delete: 'Supprimer', deleteConfirm: '?', tier_faible: 'Faible', tier_modere: 'Modéré',
  tier_eleve: 'Élevé', tier_critique: 'Critique',
  strategies: { REDUIRE: 'Réduire', ACCEPTER: 'Accepter', TRANSFERER: 'Transférer', REFUSER: 'Refuser', SURVEILLER: 'Surveiller' },
}
const NIST = {
  pageTitle: 'Processus', pageSubtitle: 'sous', phasesLabel: 'Phases',
  phases: { prepare: 'Prepare', conduct: 'Conduct', communicate: 'Communicate', maintain: 'Maintain' },
  prepareDesc: 'desc', perimetreLabel: 'Périmètre', objectifsLabel: 'Objectifs', noContext: 'Non renseigné.',
  communicateNote: 'note com', maintainNote: 'note maint',
}
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ locale: 'fr', t: { risquesDirects: RD, nist80030: NIST } }) }))

const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); fetchMock.mockResolvedValue({ ok: true, json: async () => ({ risques: [] }) } as Response); vi.stubGlobal('fetch', fetchMock) })

describe('Nist80030Workshop', () => {
  it('affiche les 4 phases NIST et Prepare par défaut (périmètre)', () => {
    render(<Nist80030Workshop analyseId="an1" editable perimetre="Système X" objectifs="Intégrité" />)
    for (const label of ['Prepare', 'Conduct', 'Communicate', 'Maintain']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
    }
    expect(screen.getByText('Système X')).toBeInTheDocument()
  })

  it('Conduct rend le registre éditable', async () => {
    render(<Nist80030Workshop analyseId="an1" editable />)
    fireEvent.click(screen.getByRole('button', { name: /Conduct/ }))
    await waitFor(() => expect(screen.getByText('Aucun risque.')).toBeInTheDocument())
    expect(screen.getByText('Ajouter')).toBeInTheDocument()
  })

  it('Communicate est en lecture seule', async () => {
    render(<Nist80030Workshop analyseId="an1" editable />)
    fireEvent.click(screen.getByRole('button', { name: /Communicate/ }))
    await waitFor(() => expect(screen.getByText('Aucun risque.')).toBeInTheDocument())
    expect(screen.queryByText('Ajouter')).toBeNull()
  })
})
