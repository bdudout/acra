import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PhasedRiskWorkshop, { type WorkshopPhase } from '@/components/PhasedRiskWorkshop'

const RD = {
  pageTitle: '', pageSubtitle: '', title: 'Risques', subtitle: '', colNom: 'Risque', nomPlaceholder: 'Intitulé',
  colGravite: 'G', colVraisemblance: 'V', colNiveau: 'Niveau', colStrategie: 'Traitement', add: 'Ajouter',
  empty: 'Aucun risque.', delete: 'Supprimer', deleteConfirm: '?', tier_faible: 'Faible', tier_modere: 'Modéré',
  tier_eleve: 'Élevé', tier_critique: 'Critique',
  strategies: { REDUIRE: 'Réduire', ACCEPTER: 'Accepter', TRANSFERER: 'Transférer', REFUSER: 'Refuser', SURVEILLER: 'Surveiller' },
}
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ locale: 'fr', t: { risquesDirects: RD } }) }))
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); fetchMock.mockResolvedValue({ ok: true, json: async () => ({ risques: [] }) } as Response); vi.stubGlobal('fetch', fetchMock) })

const isoPhases: WorkshopPhase[] = [
  { key: 'contexte', type: 'context', label: 'Contexte', desc: 'desc' },
  { key: 'identification', type: 'appreciation', label: 'Identification' },
  { key: 'evaluation', type: 'review', label: 'Évaluation', desc: 'note' },
  { key: 'note1', type: 'note', label: 'Communiquer', desc: 'à communiquer' },
]

describe('PhasedRiskWorkshop', () => {
  it('multi-phases : onglets + phase contexte par défaut (périmètre/objectifs)', () => {
    render(<PhasedRiskWorkshop analyseId="an1" editable phases={isoPhases}
      perimetre="SI prod" objectifs="Confidentialité" perimetreLabel="Périmètre" objectifsLabel="Objectifs" noContext="—" phasesLabel="Phases" />)
    expect(screen.getByRole('button', { name: /Contexte/ })).toBeInTheDocument()
    expect(screen.getByText('SI prod')).toBeInTheDocument()
    expect(screen.getByText('Confidentialité')).toBeInTheDocument()
  })

  it('phase appreciation = registre éditable ; review = lecture seule', async () => {
    render(<PhasedRiskWorkshop analyseId="an1" editable phases={isoPhases} perimetreLabel="P" objectifsLabel="O" noContext="—" phasesLabel="Phases" />)
    fireEvent.click(screen.getByRole('button', { name: /Identification/ }))
    await waitFor(() => expect(screen.getByText('Aucun risque.')).toBeInTheDocument())
    expect(screen.getByText('Ajouter')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Évaluation/ }))
    await waitFor(() => expect(screen.getByText('Aucun risque.')).toBeInTheDocument())
    expect(screen.queryByText('Ajouter')).toBeNull()
  })

  it('phase note = conseils seuls (pas de registre)', () => {
    render(<PhasedRiskWorkshop analyseId="an1" editable phases={[isoPhases[3]]} />)
    expect(screen.getByText('à communiquer')).toBeInTheDocument()
    expect(screen.queryByText('Risques')).toBeNull()
  })

  it('phase unique appreciation : pas d\'onglets (écran simple, ex. ISO 31000)', async () => {
    render(<PhasedRiskWorkshop analyseId="an1" editable phases={[{ key: 'appreciation', type: 'appreciation', label: 'Appréciation' }]} />)
    // Aucune barre d'onglets (une seule phase) mais le registre est rendu.
    expect(screen.queryByRole('button', { name: /Appréciation/ })).toBeNull()
    await waitFor(() => expect(screen.getByText('Aucun risque.')).toBeInTheDocument())
  })
})
