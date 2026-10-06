/** Fichiers d'un projet 360 (schémas, documents d'architecture, documents projet) : nature et métadonnées. */
import { describe, expect, it } from 'vitest'
import { FICHIER_PROJET_TYPES, nettoyerFichierProjet } from '@/lib/fichiers-projet'

describe('nettoyerFichierProjet', () => {
  it('nature connue (sinon AUTRE), titre par défaut = nom du fichier, borné', () => {
    expect(FICHIER_PROJET_TYPES).toEqual(['SCHEMA', 'ARCHITECTURE', 'PROJET', 'AUTRE'])
    expect(nettoyerFichierProjet({ type: 'SCHEMA', titre: '  Schéma réseau ' }, 'reseau.png')).toEqual({ type: 'SCHEMA', titre: 'Schéma réseau' })
    expect(nettoyerFichierProjet({ type: 'EXE', titre: '' }, 'dossier-architecture.pdf')).toEqual({ type: 'AUTRE', titre: 'dossier-architecture.pdf' })
    expect(nettoyerFichierProjet({ titre: 't'.repeat(400) }, 'x.pdf').titre).toHaveLength(200)
  })
})
