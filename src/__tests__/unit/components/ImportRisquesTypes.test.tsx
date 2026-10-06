import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ImportRisquesTypes from '@/components/projet360/ImportRisquesTypes'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
vi.mock('@/components/AnalyseMetaEditor', () => ({ default: () => <button type="button">modifier-contexte</button> }))
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })

const catalogue = [
  { groupe: 'REGISTRE', intitule: 'Fraude interne', gravite: 3, vraisemblance: 2, domaine: 'FRAUD', present: true },
  { groupe: 'SOUS_SECTEUR', intitule: 'Indisponibilité du bloc opératoire', gravite: 4, vraisemblance: 2, domaine: 'CYBER', present: false },
  { groupe: 'SECTEUR', intitule: 'Fuite du dossier patient', gravite: 4, vraisemblance: 3, domaine: 'CYBER', present: false },
  { groupe: 'SECTEUR', intitule: 'Panne du logiciel de prescription', gravite: 3, vraisemblance: 2, present: false },
]
const contexte = { nom: 'Projet', organisation: 'Clinique', secteur: 'Santé / Médico-social', sousSecteur: null, sousSecteurs: ['sante-clinique'], patternsArchi: ['CLOUD_IAAS_PAAS'] }

describe('ImportRisquesTypes', () => {
  it('ouvre le catalogue groupé par origine, importe la sélection et recharge le registre', async () => {
    fetchMock.mockImplementation((_u: string, init?: RequestInit) => Promise.resolve(init?.method === 'POST'
      ? { ok: true, json: async () => ({ created: 2 }) }
      : { ok: true, json: async () => ({ risques: catalogue }) }))
    const onImported = vi.fn()
    render(<ImportRisquesTypes analyseId="p1" contexte={contexte} onImported={onImported} />)
    expect(screen.getByText(/Clinique privée/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Importer des risques types/ }))
    const secteur = await screen.findByRole('group', { name: /Propres au secteur/ })
    expect((screen.getByRole('checkbox', { name: /Fraude interne/ }) as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(within(secteur).getByRole('button', { name: /Tout cocher/ }))
    fireEvent.click(screen.getByRole('button', { name: /Importer 2 risques/ }))
    await waitFor(() => expect(onImported).toHaveBeenCalled())
    const post = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')!
    expect(post[0]).toBe('/api/analyses/p1/risques-types')
    expect(JSON.parse(post[1].body)).toEqual({ intitules: ['Fuite du dossier patient', 'Panne du logiciel de prescription'] })
    expect(await screen.findByText(/2 risques importés/)).toBeTruthy()
  })
})
