// Barre de filtres partagée (cartographie / pilotage) : entité du référentiel quand il existe (lien, sous-entités),
// sinon valeurs saisies en texte libre (comportement historique).
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RiskFiltersBar from '@/components/RiskFiltersBar'
import type { EntiteRef } from '@/lib/entites'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const E = (id: string, nom: string, o: Partial<EntiteRef> = {}): EntiteRef => ({ id, nom, type: 'DIRECTION', alias: [], codeExterne: null, parentId: null, source: 'MANUEL', valideAu: null, ...o })
const base = { taxo: [], tr: (k: string) => k, processus: [] }

describe('RiskFiltersBar — entité', () => {
  it('référentiel présent : choix d’une entité (identifiant), texte libre effacé, sous-entités incluses', () => {
    const onChange = vi.fn()
    render(<RiskFiltersBar {...base} filters={{ entite: 'DSI' }} onChange={onChange} entites={['DSI', 'Achats']} referentiel={[E('g', 'Groupe'), E('dsi', 'DSI', { parentId: 'g' })]} />)
    expect(screen.queryByRole('option', { name: 'Achats' })).toBeNull() // plus de liste des textes libres
    fireEvent.change(screen.getByLabelText('Entité'), { target: { value: 'g' } })
    expect(onChange).toHaveBeenCalledWith({ entite: null, entiteId: 'g', sousEntites: true })
  })
  it('sans référentiel : liste des valeurs saisies (comportement historique)', () => {
    const onChange = vi.fn()
    render(<RiskFiltersBar {...base} filters={{}} onChange={onChange} entites={['DSI', 'Achats']} referentiel={[]} />)
    fireEvent.change(screen.getByLabelText('Toutes entités'), { target: { value: 'Achats' } })
    expect(onChange).toHaveBeenCalledWith({ entite: 'Achats' })
  })
})

describe('RiskFiltersBar — famille TIC et origine (L5)', () => {
  it('famille : valeurs traduites + « non renseignée », émet le code', () => {
    const onChange = vi.fn()
    render(<RiskFiltersBar {...base} filters={{}} onChange={onChange} entites={[]} />)
    const sel = screen.getByLabelText('Famille de risque TIC')
    expect(screen.getByRole('option', { name: 'Cybersécurité' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Non renseignée' })).toBeTruthy()
    fireEvent.change(sel, { target: { value: 'CYBER' } })
    expect(onChange).toHaveBeenCalledWith({ familleTic: 'CYBER' })
    fireEvent.change(sel, { target: { value: 'NONE' } })
    expect(onChange).toHaveBeenLastCalledWith({ familleTic: 'NONE' })
  })
  it('origine : émet la provenance, vide = null', () => {
    const onChange = vi.fn()
    render(<RiskFiltersBar {...base} filters={{ provenance: 'ACRA' }} onChange={onChange} entites={[]} />)
    const sel = screen.getByLabelText('Origine du risque')
    expect(screen.getByRole('option', { name: 'Publié depuis une analyse ACRA' })).toBeTruthy()
    fireEvent.change(sel, { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith({ provenance: null })
  })
})

describe('RiskFiltersBar — mobile', () => {
  it('les listes sont bornées à la largeur de la barre (pas de défilement horizontal à 375 px)', () => {
    render(<RiskFiltersBar {...base} filters={{}} onChange={vi.fn()} entites={[]} />)
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBeGreaterThan(0)
    for (const s of selects) expect(s.className).toContain('max-w-full')
  })
})
