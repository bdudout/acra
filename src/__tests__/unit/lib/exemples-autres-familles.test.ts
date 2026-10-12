// Pack postal, lot L7 : ateliers 3 à 5 pour les familles qui servent les autres activités d'un groupe multi-activités.
// Objectif minimal par famille : 3 sources de risque, 4 parties prenantes, 4 actions élémentaires, 3 mesures sur
// l'écosystème, 5 mesures (test de non-régression de couverture) ; textes ×5 ; énumérations valides.
import { describe, expect, it } from 'vitest'
import { sectorExemplesFor, type SectorExempleCategory } from '@/lib/exemples-sectoriels'
import { AUTRES_FAMILLES_ITEMS } from '@/lib/exemples-autres-familles'
import { TYPES_ACTION_ELEMENTAIRE } from '@/lib/ebios-data'

const MIN: [SectorExempleCategory, number][] = [['sourcesRisque', 3], ['partiesPrenantes', 4], ['actionsElementaires', 4], ['mesuresEcosysteme', 3], ['mesures', 5]]
const CAS: [string, string | undefined][] = [
  ['Banque / Finance', 'banque-detail'], ['Banque / Finance', 'banque-reseau-tiers'],
  ['Informatique / Numérique', 'numerique-confiance'], ['Informatique / Numérique', 'numerique-identite'], ['Informatique / Numérique', 'numerique-coffre'],
  ['Télécommunications', 'telecom-virtuel'], ['Administration publique', undefined],
]

describe('ateliers 3 à 5 des autres familles', () => {
  it('seuils minimaux par famille et sous-secteur', () => {
    for (const [secteur, sous] of CAS) for (const [cat, min] of MIN) expect(sectorExemplesFor(secteur, cat, 'fr', sous).length, `${secteur} ${sous} ${cat}`).toBeGreaterThanOrEqual(min)
  })
  it('contenu bancaire non proposé à un assureur ; opérateur hôte réservé à l’opérateur virtuel', () => {
    expect(JSON.stringify(sectorExemplesFor('Banque / Finance', 'mesures', 'fr', 'banque-assurance'))).not.toMatch(/bénéficiaires ajoutés/)
    expect(JSON.stringify(sectorExemplesFor('Télécommunications', 'partiesPrenantes', 'fr', 'telecom-reseau'))).not.toMatch(/réseau hôte/)
    expect(JSON.stringify(sectorExemplesFor('Télécommunications', 'partiesPrenantes', 'fr', 'telecom-virtuel'))).toMatch(/réseau hôte/)
  })
  it('5 langues non vides ; énumérations valides', () => {
    const AE = new Set(TYPES_ACTION_ELEMENTAIRE.map(t => t.value))
    const SR = new Set(['CYBERCRIMINEL', 'ETAT_NATION', 'CONCURRENT', 'ACTIVISTE', 'EMPLOYE_MALVEILLANT', 'PRESTATAIRE', 'AMATEUR', 'TERRORISTE', 'AUTRE'])
    const PP = new Set(['PRESTATAIRE', 'FOURNISSEUR', 'CLIENT', 'PARTENAIRE', 'ORGANISME_REGULATION', 'AUTRE'])
    for (const x of AUTRES_FAMILLES_ITEMS) {
      for (const v of Object.values(x.data)) if (Array.isArray(v) && v.length === 5 && v.every(t => typeof t === 'string')) for (const t of v as string[]) expect(t.trim().length).toBeGreaterThan(0)
      if (x.category === 'actionsElementaires') { expect(AE.has(String(x.data.type))).toBe(true); expect(String(x.data.attack)).toMatch(/^T\d{4}(\.\d{3})?$/) }
      if (x.category === 'sourcesRisque') expect(SR.has(String(x.data.categorie))).toBe(true)
      if (x.category === 'partiesPrenantes') expect(PP.has(String(x.data.type))).toBe(true)
    }
  })
})
