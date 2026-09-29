import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChampsPersonnalisesFields from '@/components/ChampsPersonnalisesFields'
import { usePersonnalisationChamps } from '@/components/usePersonnalisationChamps'
import type { ChampDef } from '@/lib/champs-perso'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})

const defs: ChampDef[] = [
  { code: 'ticket', label: 'Ticket ITSM', type: 'TEXTE' },
  { code: 'nb', label: 'Clients touchés', type: 'NOMBRE', requis: true },
  { code: 'urgence', label: 'Urgence', type: 'LISTE', options: ['Basse', 'Haute'] },
  { code: 'comite', label: 'Date de comité', type: 'DATE' },
  { code: 'externe', label: 'Prestataire externe ?', type: 'OUINON' },
]

describe('ChampsPersonnalisesFields', () => {
  it('ne rend rien sans champ défini', () => {
    const { container } = render(<ChampsPersonnalisesFields defs={[]} values={{}} onChange={() => {}} />)
    expect(container.textContent).toBe('')
  })
  it('un contrôle par type ; chaque saisie émet les valeurs complètes', () => {
    const onChange = vi.fn()
    render(<ChampsPersonnalisesFields defs={defs} values={{ ticket: 'INC-1' }} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Clients touchés *'), { target: { value: '120' } })
    expect(onChange).toHaveBeenLastCalledWith({ ticket: 'INC-1', nb: 120 })
    fireEvent.change(screen.getByLabelText('Urgence'), { target: { value: 'Haute' } })
    expect(onChange).toHaveBeenLastCalledWith({ ticket: 'INC-1', urgence: 'Haute' })
    fireEvent.change(screen.getByLabelText('Date de comité'), { target: { value: '2026-10-05' } })
    expect(onChange).toHaveBeenLastCalledWith({ ticket: 'INC-1', comite: '2026-10-05' })
    fireEvent.click(screen.getByLabelText('Prestataire externe ?'))
    expect(onChange).toHaveBeenLastCalledWith({ ticket: 'INC-1', externe: true })
    fireEvent.change(screen.getByLabelText('Ticket ITSM'), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith({})
  })
  it('lecture seule : valeurs affichées, aucun champ éditable', () => {
    render(<ChampsPersonnalisesFields defs={defs} values={{ ticket: 'INC-1', externe: true }} onChange={() => {}} readOnly />)
    expect(screen.getByText('INC-1')).toBeTruthy()
    expect(screen.queryByLabelText('Ticket ITSM')).toBeNull()
  })
})

describe('usePersonnalisationChamps', () => {
  const fetchMock = vi.fn()
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
  function Probe({ mod }: { mod: 'incident' | 'controle' | 'mission' }) {
    const d = usePersonnalisationChamps(mod)
    return <p data-testid="n">{d.length}</p>
  }
  it('charge les définitions du module ; échec réseau → liste vide', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ champs: { incident: defs, controle: [defs[0]] } }) })
    render(<Probe mod="incident" />)
    await waitFor(() => expect(screen.getByTestId('n').textContent).toBe('5'))
    fetchMock.mockRejectedValue(new Error('offline'))
    render(<Probe mod="mission" />)
    expect(screen.getAllByTestId('n').at(-1)!.textContent).toBe('0')
  })
})
