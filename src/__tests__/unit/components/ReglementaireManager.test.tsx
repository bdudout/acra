// Recette n° 46 : le lien « Évaluer la classification DORA » de la fenêtre Déclaration d'un incident
// ouvre directement le formulaire d'évaluation de CET incident dans le registre DORA.
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReglementaireManager from '@/components/ReglementaireManager'
import { fr } from '@/lib/i18n/fr'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const row = (id: string, intitule: string) => ({ id, intitule, statut: 'OUVERT', dateSurvenance: null, montantBrut: null, recuperations: null, criteres: { clientsAffectes: id === 'i2' ? 120 : null }, evalue: false, classe: null, declenches: [] })
const data = {
  active: true, canAssess: true, incidents: [row('i1', 'Panne messagerie'), row('i2', 'DDoS portail client')],
  synthese: { evalues: 0, majeurs: 0, significatifs: 0, mineurs: 0 },
  ldc: { nbIncidents: 0, perteBruteTotale: 0, recuperationsTotales: 0, perteNetteTotale: 0 },
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => data } as Response)))
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { window.history.replaceState(null, '', '/') })

describe('ReglementaireManager — ouverture depuis un incident (n° 46)', () => {
  it('?incident=i2 : ouvre l’évaluation de cet incident, critères préremplis', async () => {
    window.history.replaceState(null, '', '/reglementaire?incident=i2')
    render(<ReglementaireManager canAssess />)
    const champ = await screen.findByLabelText(fr.reglementaire.criteres.clientsAffectes)
    expect(champ).toHaveValue(120)
    expect(screen.getAllByRole('button', { name: fr.reglementaire.save })).toHaveLength(1)
  })
  it('sans droit d’évaluer : rien ne s’ouvre', async () => {
    window.history.replaceState(null, '', '/reglementaire?incident=i2')
    render(<ReglementaireManager canAssess={false} />)
    await screen.findByText('DDoS portail client')
    expect(screen.queryByRole('button', { name: fr.reglementaire.save })).toBeNull()
  })
})
