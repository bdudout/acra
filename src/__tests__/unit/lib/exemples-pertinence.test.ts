/**
 * Pertinence des exemples : on sait POURQUOI un exemple est proposé (cas d'usage = sous-secteur choisi, architecture =
 * pattern coché), il remonte en tête et le badge le dit. Sans surcharge : plafond par pattern et par catégorie.
 */
import { describe, expect, it } from 'vitest'
import { sectorExemplesFor } from '@/lib/exemples-sectoriels'
import { patternExemplesFor, MAX_EXEMPLES_PAR_PATTERN } from '@/lib/exemples-patterns'
import { rankExemples } from '@/lib/exemples-context'

const PS = 'Protection sociale / Sécurité sociale'
type Ex = Record<string, unknown>
const nom = (x: Ex) => String(x.nom ?? x.mesure ?? x.description)

describe('origine des exemples', () => {
  it('un élément propre au sous-secteur choisi est marqué « cas d’usage »', () => {
    const items = sectorExemplesFor(PS, 'mesures', 'fr', ['protsoc-services-usagers']) as Ex[]
    const usagers = items.find(x => /compte usager/i.test(nom(x)))!
    expect(usagers.pertinence).toBe('CAS_USAGE')
    // le socle commun du secteur n'est pas marqué
    expect(items.some(x => x.pertinence === undefined)).toBe(true)
  })
  it('sans sous-secteur choisi, rien n’est marqué « cas d’usage »', () => {
    expect((sectorExemplesFor('Banque / Finance', 'mesures', 'fr') as Ex[]).some(x => x.pertinence === 'CAS_USAGE')).toBe(false)
  })
  it('un élément d’un pattern coché est marqué « architecture », avec le ou les patterns concernés', () => {
    const items = sectorExemplesFor(PS, 'mesures', 'fr', [], ['TELEMAINTENANCE']) as Ex[]
    const tm = items.find(x => /télémaintenance/i.test(nom(x)))!
    expect(tm).toMatchObject({ pertinence: 'ARCHITECTURE', patternsPertinents: ['TELEMAINTENANCE'] })
  })
  it('une combinaison porte tous ses patterns', () => {
    const items = sectorExemplesFor(null, 'mesures', 'fr', [], ['TELEMAINTENANCE', 'SI_INDUSTRIEL']) as Ex[]
    expect(items.some(x => Array.isArray(x.patternsPertinents) && (x.patternsPertinents as string[]).length === 2)).toBe(true)
  })
})

describe('classement et badges', () => {
  it('cas d’usage puis architecture passent devant les exemples génériques, même sans mot-clé du secteur', () => {
    const generic: Ex[] = [{ nom: 'Patient et dossier médical' }, { nom: 'Générique sans rapport' }]
    const tagged: Ex[] = [{ nom: 'Accès de télémaintenance', pertinence: 'ARCHITECTURE', patternsPertinents: ['TELEMAINTENANCE'] }, { nom: 'Compte usager', pertinence: 'CAS_USAGE' }]
    const r = rankExemples([...generic, ...tagged], { secteur: 'Santé / Médico-social' })
    expect(r.map(x => x.nom)).toEqual(['Compte usager', 'Accès de télémaintenance', 'Patient et dossier médical', 'Générique sans rapport'])
    expect(r.map(x => x.pertinence)).toEqual(['CAS_USAGE', 'ARCHITECTURE', 'SECTEUR', undefined])
    expect(r.slice(0, 3).every(x => x.pertinent)).toBe(true)
  })
})

describe('sans surcharge', () => {
  it('au plus MAX_EXEMPLES_PAR_PATTERN éléments par pattern et par catégorie', () => {
    expect(MAX_EXEMPLES_PAR_PATTERN).toBeLessThanOrEqual(5)
    expect(patternExemplesFor(['INTERCO_TIERS'], 'mesures', 'fr').length).toBeLessThanOrEqual(MAX_EXEMPLES_PAR_PATTERN)
  })
})
