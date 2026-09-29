// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { renderAnalyseDocx } from '../../../lib/analyse-docx'

const analyse = {
  nom: 'Analyse SI hôpital', organisation: 'CHU Démo', secteur: 'Santé', mentionProtection: 'RESTREINTE',
  statut: 'APPROUVE', versionMajeure: 2, versionMineure: 1,
  cadrage: {
    perimetre: 'Système d’information hospitalier et services de soins critiques.',
    valeursMetier: [{ nom: 'Dossier patient' }, { nom: 'Prise de rendez-vous' }],
    biensSupports: [{ nom: 'SGBD' }, { nom: 'Réseau LAN' }],
    socleSecurite: [{ ref: '5.1', statut: 'conforme' }, { ref: '8.8', statut: 'partiel' }],
  },
  sourcesRisque: [{ nom: 'Cybercriminel', categorie: 'CYBERCRIMINEL', pertinence: 3, retenu: true, objectifsVises: [{ nom: 'Rançongiciel' }] }],
  partiesPrenantes: [{ nom: 'Hébergeur', type: 'PRESTATAIRE', exposition: 12, fiabilite: 6 }],
  scenariosStrategiques: [{ nom: 'Chiffrement des serveurs', gravite: 4, vraisemblance: 3, niveauRisque: 12, retenu: true }],
  risques: [
    { nom: 'Indisponibilité des soins', gravite: 4, vraisemblance: 3, niveauRisque: 12, strategie: 'REDUIRE', niveauResiduel: 6 },
    { nom: 'Fuite de données patients', gravite: 4, vraisemblance: 2, niveauRisque: 8, strategie: 'REDUIRE', niveauResiduel: 4 },
  ],
  mesures: [
    { nom: 'Sauvegardes isolées', type: 'PREVENTIVE', priorite: 1, statut: 'EN_COURS', responsable: 'DSI', echeance: '2026-06-01' },
    { nom: 'MFA généralisé', type: 'PREVENTIVE', priorite: 2, statut: 'REALISE', responsable: 'RSSI' },
  ],
  revisions: [{ version: '2.1', createdAt: '2026-07-15', note: 'Révision post-audit' }],
}

describe('renderAnalyseDocx', () => {
  it('produit un Buffer .docx valide (signature ZIP « PK ») en fr et en', async () => {
    for (const loc of ['fr', 'en']) {
      const buf = await renderAnalyseDocx(analyse as Record<string, unknown>, null, loc)
      expect(Buffer.isBuffer(buf)).toBe(true)
      expect(buf.length).toBeGreaterThan(3000)
      expect(buf[0]).toBe(0x50) // P
      expect(buf[1]).toBe(0x4b) // K
    }
  })

  it('ne plante pas sur une analyse vide', async () => {
    const buf = await renderAnalyseDocx({ nom: 'Vide' } as Record<string, unknown>, null, 'fr')
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(2000)
  })
})

describe('renderAnalyseDocx — matrice des risques', () => {
  async function documentXml(loc: string, data: Record<string, unknown> = analyse as Record<string, unknown>) {
    const JSZip = (await import('jszip')).default
    const buf = await renderAnalyseDocx(data, null, loc)
    return (await (await JSZip.loadAsync(buf)).file('word/document.xml')!.async('string'))
  }
  it('contient la matrice (brute, puis après traitement quand des cotations résiduelles existent) avec les risques Rn placés', async () => {
    const xml = await documentXml('fr')
    expect(xml).toContain('Matrice des risques')
    expect(xml).toContain('Risque brut'); expect(xml).toContain('Après traitement')
    expect(xml).toContain('Gravité →'); expect(xml).toContain('Vraisemblance ↑')
    expect(xml).toContain('R1'); expect(xml).toContain('R2')
    expect(xml).toMatch(/w:fill="[0-9A-F]{6}"/) // cases colorées selon les paliers
  })
  it('sans risque : pas de matrice ; sans cotation résiduelle : une seule matrice', async () => {
    expect(await documentXml('fr', { nom: 'Vide' })).not.toContain('Matrice des risques')
    const xml = await documentXml('fr', { nom: 'X', risques: [{ nom: 'Seul', gravite: 2, vraisemblance: 2, niveauRisque: 4 }] })
    expect(xml).toContain('Matrice des risques'); expect(xml).not.toContain('Après traitement')
  })
  it.each([['en', 'Risk matrix'], ['de', 'Risikomatrix'], ['es', 'Matriz de riesgos'], ['it', 'Matrice dei rischi']])('libellés traduits (%s)', async (loc, title) => {
    expect(await documentXml(loc)).toContain(title)
  })
})
