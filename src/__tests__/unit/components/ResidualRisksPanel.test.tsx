// Recette n° 56 : le panneau montre ce qui est accepté (risques résiduels par niveau, non cotés
// avec lien vers la liste) et désactive « Accepter » / « Refuser » avec le motif tant que
// l'analyse n'est pas soumise / approuvée ou qu'un risque reste non coté.
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ResidualRisksPanel from '@/components/ResidualRisksPanel'
import { resumeRisquesResiduels } from '@/lib/acceptation-residuels'
import { fr } from '@/lib/i18n/fr'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const r = fr.residualRisks
const base = { analyseId: 'a1', statut: 'EN_ATTENTE', le: null, commentaire: null, canAct: true, locale: 'fr' }

describe('ResidualRisksPanel — résumé et préconditions (n° 56)', () => {
  it('affiche les risques par niveau et les non cotés avec un lien vers la liste', () => {
    const resume = resumeRisquesResiduels([{ niveauResiduel: 16 }, { niveauResiduel: 2 }, { niveauResiduel: 1 }, { niveauResiduel: null }])
    render(<ResidualRisksPanel {...base} statutAnalyse="SOUMIS" resume={resume} risquesHref="/analyses/a1/atelier/5" />)
    expect(screen.getByText(fr.risquesDirects.tier_critique).closest('li')).toHaveTextContent('1')
    expect(screen.getByText(fr.risquesDirects.tier_faible).closest('li')).toHaveTextContent('2')
    expect(screen.getByText(r.unrated).closest('li')).toHaveTextContent('1')
    expect(screen.getByRole('link', { name: r.seeRisks })).toHaveAttribute('href', '/analyses/a1/atelier/5')
  })

  it('analyse EN_COURS : boutons désactivés, motif affiché', () => {
    render(<ResidualRisksPanel {...base} statutAnalyse="EN_COURS" resume={resumeRisquesResiduels([{ niveauResiduel: 4 }])} risquesHref="/x" />)
    expect(screen.getByRole('button', { name: r.accept })).toBeDisabled()
    expect(screen.getByRole('button', { name: r.refuse })).toBeDisabled()
    expect(screen.getByText(r.blocked.ANALYSE_NON_SOUMISE)).toBeInTheDocument()
  })

  it('risque non coté : « Accepter » désactivé, motif affiché', () => {
    render(<ResidualRisksPanel {...base} statutAnalyse="APPROUVE" resume={resumeRisquesResiduels([{ niveauResiduel: null }])} risquesHref="/x" />)
    expect(screen.getByRole('button', { name: r.accept })).toBeDisabled()
    expect(screen.getByText(r.blocked.RISQUES_NON_COTES)).toBeInTheDocument()
  })

  it('analyse approuvée, tout coté : « Accepter » actif, aucun motif', () => {
    render(<ResidualRisksPanel {...base} statutAnalyse="APPROUVE" resume={resumeRisquesResiduels([{ niveauResiduel: 4 }])} risquesHref="/x" />)
    expect(screen.getByRole('button', { name: r.accept })).toBeEnabled()
    expect(screen.queryByText(r.blocked.ANALYSE_NON_SOUMISE)).toBeNull()
    expect(screen.queryByText(r.blocked.RISQUES_NON_COTES)).toBeNull()
  })
})
