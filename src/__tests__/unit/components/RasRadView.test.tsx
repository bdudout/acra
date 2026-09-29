import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RasRadView, { type RasRadData } from '@/components/RasRadView'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const data: RasRadData = {
  global: 'ROUGE',
  modules: { registre: true, maturite: true, kri: false },
  appetit: {
    seuilGlobal: 8, categories: [{ code: 'OP', label: 'Risque opérationnel', seuil: 6 }],
    synthese: { total: 5, evalues: 4, horsAppetit: 1, dansAppetit: 3, sansSeuil: 1 }, tauxConformite: 75,
    depassements: [{ intitule: 'Rançongiciel', categorieLabel: 'Risque opérationnel', niveauResiduel: 12, seuil: 6, ecart: 6 }],
    voyant: 'ROUGE',
  },
  maturite: [{ code: 'NIST_CSF', nom: 'NIST CSF (2.0)', cible: 3, averageCurrent: 2.4, averageTarget: 3, belowTarget: 5, assessed: 20, total: 100, voyant: 'ORANGE' }],
  kri: null,
}

describe('RasRadView', () => {
  it('RAS : seuils d’appétit et maturité visée ; RAD : voyants et dépassements', () => {
    render(<RasRadView data={data} />)
    const ras = screen.getByRole('region', { name: 'Déclaration d’appétence (RAS)' })
    expect(within(ras).getByText('Risque opérationnel')).toBeTruthy()
    expect(within(ras).getByText('NIST CSF (2.0)')).toBeTruthy()
    const rad = screen.getByRole('region', { name: 'Tableau de bord d’appétence (RAD)' })
    expect(within(rad).getByText('3/4 dans l’appétit · 1 au-dessus')).toBeTruthy()
    expect(within(rad).getByText('Rançongiciel')).toBeTruthy()
    expect(within(rad).getByText('actuelle 2.4 / visée 3 · 5 point(s) sous la cible')).toBeTruthy()
    // KRI désactivé : signalé, sans voyant.
    expect(within(rad).getByText('Module non activé')).toBeTruthy()
    expect(screen.getByText(/Statut global/).parentElement?.textContent).toContain('Limite franchie')
  })

  it('présente le bandeau explicatif du module', async () => {
    render(<RasRadView data={data} />)
    expect(await screen.findByText('À quoi ça sert')).toBeTruthy()
  })
})
