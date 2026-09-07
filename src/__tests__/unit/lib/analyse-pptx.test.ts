// @vitest-environment node
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { renderAnalysePptx, topScenarioNarratives } from '../../../lib/analyse-pptx'

/** Concatène le XML de toutes les diapositives d'un PPTX (pour vérifier le contenu localisé). */
async function slidesText(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf)
  const files = Object.keys(zip.files).filter(n => /ppt\/slides\/slide\d+\.xml$/.test(n))
  const parts = await Promise.all(files.map(n => zip.files[n].async('string')))
  return parts.join('\n')
}

const analyse = {
  nom: 'Analyse SI hôpital', organisation: 'CHU Démo', secteur: 'Santé', sousSecteur: 'ES_PUBLIC',
  mentionProtection: 'RESTREINTE', statut: 'APPROUVE', versionMajeure: 2, versionMineure: 1,
  cadrage: {
    perimetre: 'Système d’information hospitalier et services de soins critiques.',
    valeursMetier: [{ id: 'vm1', nom: 'Dossier patient' }, { id: 'vm2', nom: 'Prise de rendez-vous' }],
    biensSupports: [{ nom: 'SGBD' }, { nom: 'Réseau LAN' }],
    evenementsRedoutes: [
      { id: 'er1', valeurMetierId: 'vm1', description: 'Indisponibilité du DPI', gravite: 4, impacts: ['Continuité des soins'] },
    ],
    socleSecurite: [{ ref: '5.1', statut: 'conforme' }, { ref: '8.8', statut: 'partiel' }, { ref: '8.16', statut: 'non_conforme' }],
  },
  sourcesRisque: [{ id: 'sr1', nom: 'Cybercriminel', categorie: 'CYBERCRIMINEL', pertinence: 3, retenu: true, objectifsVises: [{ nom: 'Rançongiciel' }] }],
  partiesPrenantes: [{ nom: 'Hébergeur', type: 'PRESTATAIRE', exposition: 12, fiabilite: 6 }],
  scenariosStrategiques: [
    {
      nom: 'Rançongiciel via l’hébergeur', sourceRisqueId: 'sr1', objectifVise: 'Chiffrer les serveurs',
      evenementRedouteRef: 'er1', cheminAttaque: [
        { etape: 1, partiePrenante: 'Hébergeur HDS', action: 'Compromission' },
        { etape: 2, partiePrenante: 'SI interne', action: 'Propagation' },
      ], gravite: 4, vraisemblance: 3, niveauRisque: 12, retenu: true,
    },
    { nom: 'Fuite de données', sourceRisqueId: 'sr1', objectifVise: 'Exfiltrer', gravite: 4, vraisemblance: 2, niveauRisque: 8, retenu: true },
  ],
  risques: [
    { id: 'r1', nom: 'Indisponibilité des soins', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE', graviteResiduelle: 3, vraisemblanceResiduelle: 2, niveauResiduel: 6, evenementRedouteRef: 'er1' },
    { id: 'r2', nom: 'Fuite de données patients', gravite: 4, vraisemblance: 2, niveauRisque: 8, strategie: 'REDUIRE', niveauResiduel: 4 },
  ],
  mesures: [
    { nom: 'Sauvegardes isolées', type: 'PREVENTIVE', categorieEbios: 'RESILIENCE', priorite: 1, statut: 'EN_COURS', responsable: 'DSI', echeance: '2026-06-01', cout: '20 k€', efficacite: 3, risqueId: 'r1' },
    { nom: 'MFA généralisé', type: 'PREVENTIVE', categorieEbios: 'PROTECTION', priorite: 2, statut: 'REALISE', responsable: 'RSSI', efficacite: 4, risqueId: 'r2' },
  ],
}

describe('topScenarioNarratives', () => {
  it('résout source, objectif, chemin d’attaque et impact métier, triés par niveau', () => {
    const nar = topScenarioNarratives(analyse as Record<string, unknown>, 3)
    expect(nar.length).toBe(2)
    expect(nar[0].niveau).toBe(12) // trié décroissant
    expect(nar[0].source).toBe('Cybercriminel') // sourceRisqueId → nom
    expect(nar[0].objectif).toBe('Chiffrer les serveurs')
    expect(nar[0].chemin).toEqual(['Hébergeur HDS', 'SI interne']) // cheminAttaque → parties prenantes
    expect(nar[0].impact).toBe('Indisponibilité du DPI') // evenementRedouteRef → ER description
  })

  it('ne plante pas sans scénarios (retourne un tableau vide)', () => {
    expect(topScenarioNarratives({ nom: 'x' } as Record<string, unknown>, 3)).toEqual([])
  })
})

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

  it('accepte l’appétit et une matrice qualitative sans planter', async () => {
    const cfg = {
      matriceMode: 'QUALITATIVE',
      matriceQualitative: [{ gravite: 4, vraisemblance: 3, seuilLabel: 'Critique' }],
    }
    const buf = await renderAnalysePptx(
      analyse as Record<string, unknown>, cfg as Record<string, unknown>, 'fr',
      { appetit: { seuilGlobal: 4, parCategorie: {} }, approbateurNom: 'Alice Martin' },
    )
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(3000)
  })

  it('localise le contenu des diapositives en fr / de / es / it', async () => {
    const titres: Record<string, string> = {
      fr: 'Synthèse pour la direction',
      de: 'Zusammenfassung für die Leitung',
      es: 'Resumen para la dirección',
      it: 'Sintesi per la direzione',
    }
    for (const [loc, titre] of Object.entries(titres)) {
      const buf = await renderAnalysePptx(analyse as Record<string, unknown>, null, loc)
      const xml = await slidesText(buf)
      expect(xml).toContain(titre)
    }
  })

  it('ne plante pas sur une analyse vide (aucun risque / mesure)', async () => {
    const buf = await renderAnalysePptx({ nom: 'Vide' } as Record<string, unknown>, null, 'fr')
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(2000)
  })
})
