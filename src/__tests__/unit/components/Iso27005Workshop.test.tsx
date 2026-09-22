import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Iso27005Workshop from '@/components/Iso27005Workshop'

const RD = {
  pageTitle: '', pageSubtitle: '', title: 'Risques', subtitle: '', colNom: 'Risque', nomPlaceholder: 'Intitulé',
  colGravite: 'G', colVraisemblance: 'V', colNiveau: 'Niveau', colStrategie: 'Traitement', add: 'Ajouter',
  empty: 'Aucun risque.', delete: 'Supprimer', deleteConfirm: '?', tier_faible: 'Faible', tier_modere: 'Modéré',
  tier_eleve: 'Élevé', tier_critique: 'Critique',
  strategies: { REDUIRE: 'Réduire', ACCEPTER: 'Accepter', TRANSFERER: 'Transférer', REFUSER: 'Refuser', SURVEILLER: 'Surveiller' },
}
const ISO = {
  pageTitle: 'Processus', pageSubtitle: 'sous', phasesLabel: 'Phases',
  phases: { contexte: 'Contexte', identification: 'Identification', analyse: 'Analyse', evaluation: 'Évaluation', traitement: 'Traitement' },
  contexteDesc: 'desc', perimetreLabel: 'Périmètre', objectifsLabel: 'Objectifs', noContext: 'Non renseigné.', evaluationNote: 'note',
}
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({ locale: 'fr', t: { risquesDirects: RD, iso27005: ISO } }) }))

const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); fetchMock.mockResolvedValue({ ok: true, json: async () => ({ risques: [] }) } as Response); vi.stubGlobal('fetch', fetchMock) })

describe('Iso27005Workshop', () => {
  it('affiche les 5 phases et la phase Contexte par défaut (périmètre)', () => {
    render(<Iso27005Workshop analyseId="an1" editable perimetre="Le SI de production" objectifs="Confidentialité" />)
    for (const label of ['Contexte', 'Identification', 'Analyse', 'Évaluation', 'Traitement']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument()
    }
    expect(screen.getByText('Le SI de production')).toBeInTheDocument()
    expect(screen.getByText('Confidentialité')).toBeInTheDocument()
  })

  it('la phase Identification rend le registre de risques (éditable)', async () => {
    render(<Iso27005Workshop analyseId="an1" editable />)
    fireEvent.click(screen.getByRole('button', { name: /Identification/ }))
    await waitFor(() => expect(screen.getByText('Aucun risque.')).toBeInTheDocument())
    expect(screen.getByText('Ajouter')).toBeInTheDocument()
  })

  it('la phase Évaluation est en lecture seule (pas de bouton Ajouter)', async () => {
    render(<Iso27005Workshop analyseId="an1" editable />)
    fireEvent.click(screen.getByRole('button', { name: /Évaluation/ }))
    await waitFor(() => expect(screen.getByText('Aucun risque.')).toBeInTheDocument())
    expect(screen.queryByText('Ajouter')).toBeNull()
  })
})
