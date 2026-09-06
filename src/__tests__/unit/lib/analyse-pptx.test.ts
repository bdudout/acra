// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { renderAnalysePptx } from '../../../lib/analyse-pptx'

const analyse = {
  nom: 'Analyse SI hôpital', organisation: 'CHU Démo', secteur: 'Santé', mentionProtection: 'RESTREINTE',
  cadrage: {
    perimetre: 'Système d’information hospitalier et services de soins critiques.',
    valeursMetier: [{ nom: 'Dossier patient' }, { nom: 'Prise de rendez-vous' }],
    biensSupports: [{ nom: 'SGBD' }, { nom: 'Réseau LAN' }],
    socleSecurite: [{ ref: '5.1', statut: 'conforme' }, { ref: '8.8', statut: 'partiel' }, { ref: '8.16', statut: 'non_conforme' }],
  },
  sourcesRisque: [{ nom: 'Cybercriminel', categorie: 'CYBERCRIMINEL', pertinence: 3, retenu: true, objectifsVises: [{ nom: 'Rançongiciel' }] }],
  partiesPrenantes: [{ nom: 'Hébergeur', type: 'PRESTATAIRE', exposition: 12, fiabilite: 6 }],
  scenariosStrategiques: [{ nom: 'Chiffrement des serveurs', gravite: 4, vraisemblance: 3, niveauRisque: 12, retenu: true }],
  risques: [
    { nom: 'Indisponibilité des soins', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE', niveauResiduel: 6 },
    { nom: 'Fuite de données patients', gravite: 4, vraisemblance: 2, niveauRisque: 8, strategie: 'REDUIRE', niveauResiduel: 4 },
  ],
  mesures: [
    { nom: 'Sauvegardes isolées', type: 'TECHNIQUE', priorite: 1, statut: 'EN_COURS', responsable: 'DSI', echeance: '2026-06-01' },
    { nom: 'MFA généralisé', type: 'TECHNIQUE', priorite: 2, statut: 'REALISE', responsable: 'RSSI' },
  ],
}

describe('renderAnalysePptx', () => {
  it('produit un Buffer PPTX non vide (signature ZIP « PK ») dans chaque langue', async () => {
    for (const loc of ['fr', 'en', 'de', 'es', 'it']) {
      const buf = await renderAnalysePptx(analyse as Record<string, unknown>, { echelleGravite: [1, 2, 3, 4] } as Record<string, unknown>, loc)
      expect(Buffer.isBuffer(buf)).toBe(true)
      expect(buf.length).toBeGreaterThan(3000)
      expect(buf[0]).toBe(0x50) // P
      expect(buf[1]).toBe(0x4b) // K
    }
  })

  it('ne plante pas sur une analyse vide (aucun risque / mesure)', async () => {
    const buf = await renderAnalysePptx({ nom: 'Vide' } as Record<string, unknown>, null, 'fr')
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(2000)
  })
})
