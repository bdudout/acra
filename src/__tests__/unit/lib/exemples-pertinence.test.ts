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

describe('pas de doublon avec les exemples génériques', () => {
  it('la partie prenante d’un pattern qui existe déjà en générique n’apparaît qu’une fois, avec le badge architecture', async () => {
    const { withSectorExemples } = await import('@/lib/exemples-sectoriels')
    const { defaultExemplesFor } = await import('@/lib/exemples-defaults')
    const I = await import('@/lib/i18n')
    for (const l of ['fr', 'en', 'de', 'es', 'it'] as const) {
      const generic = defaultExemplesFor('partiesPrenantes', I[l] as never, l) as Ex[]
      const out = withSectorExemples(generic, null, 'partiesPrenantes', l, [], ['CLOUD_SAAS', 'CLOUD_IAAS_PAAS'])
      for (const code of ['CLOUD_SAAS', 'CLOUD_IAAS_PAAS']) {
        const tagged = out.filter(x => (x.patternsPertinents as string[] | undefined)?.includes(code))
        expect(tagged, `${l} ${code}`).toHaveLength(1)
        expect(out.filter(x => String(x.nom) === String(tagged[0].nom)), `${l} ${code}`).toHaveLength(1)
        expect(generic.some(g => g.nom === tagged[0].nom), `${l} ${code} reprend le libellé générique`).toBe(true)
      }
    }
  })
})

describe('plusieurs patterns cochés : plafond global, chaque pattern représenté', () => {
  it('au plus MAX_EXEMPLES_ARCHITECTURE par catégorie ; le premier exemple de chaque pattern est présent ; combinaisons en tête', async () => {
    const { MAX_EXEMPLES_ARCHITECTURE, patternExemplesTagged } = await import('@/lib/exemples-patterns')
    const codes = ['EXPOSITION_INTERNET', 'DMZ', 'TELEMAINTENANCE', 'SI_INDUSTRIEL', 'SI_ADMINISTRATION', 'SAUVEGARDE', 'CLOUD_SAAS', 'BUREAUTIQUE']
    const r = patternExemplesTagged(codes, 'mesures', 'fr')
    expect(MAX_EXEMPLES_ARCHITECTURE).toBeLessThanOrEqual(12)
    expect(r.length).toBeLessThanOrEqual(MAX_EXEMPLES_ARCHITECTURE)
    expect(r[0].patterns).toEqual(['TELEMAINTENANCE', 'SI_INDUSTRIEL'])
    for (const c of codes) expect(r.some(x => x.patterns.length === 1 && x.patterns[0] === c), c).toBe(true)
  })
})
