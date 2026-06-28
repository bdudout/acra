import { describe, it, expect } from 'vitest'
import { detectRgpdArt9 } from '@/lib/rgpd-sensitive'

// Détection des données particulières RGPD Art. 9 (improvements-priority.md 🟠).

describe('detectRgpdArt9', () => {
  it('détecte les données de santé', () => {
    expect(detectRgpdArt9([{ nom: 'Dossier patient informatisé', description: 'Données médicales' }])).toContain('sante')
  })
  it('détecte la biométrie et la génétique', () => {
    expect(detectRgpdArt9([{ nom: 'Données biométriques', description: 'empreinte digitale' }])).toContain('biometrie')
    expect(detectRgpdArt9([{ nom: 'Analyses ADN', description: 'séquençage du génome' }])).toContain('genetique')
  })
  it('insensible aux accents et à la casse', () => {
    expect(detectRgpdArt9([{ nom: 'SANTÉ', description: '' }])).toContain('sante')
  })
  it('renvoie les catégories sans doublon, triées dans l’ordre canonique', () => {
    const r = detectRgpdArt9([
      { nom: 'Orientation sexuelle' },
      { nom: 'Dossier patient', description: 'maladie' },
    ])
    expect(r).toEqual(['sante', 'orientation'])
  })
  it('ne déclenche pas de faux positif sur des termes proches', () => {
    expect(detectRgpdArt9([{ nom: 'Politique de sécurité', description: 'Syndic de copropriété' }])).toEqual([])
    expect(detectRgpdArt9([{ nom: 'Gestion des commandes', description: 'Facturation' }])).toEqual([])
  })
  it('liste vide / champs absents → []', () => {
    expect(detectRgpdArt9([])).toEqual([])
    expect(detectRgpdArt9([{}, { nom: '' }])).toEqual([])
  })
})
