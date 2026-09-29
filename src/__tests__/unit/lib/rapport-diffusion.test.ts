import { describe, expect, it } from 'vitest'
import { classerDestinataires } from '@/lib/rapport-diffusion'
import { rapportDiffusionEmail } from '@/lib/email-i18n'

const membres = [{ email: 'Alice@Acme.fr', locale: 'en' }, { email: 'bob@acme.fr', locale: null }]

describe('classerDestinataires', () => {
  it('adresse d’un membre → envoi (insensible à la casse) ; hors organisation → non envoyé ; nom simple → traçabilité seule', () => {
    const r = classerDestinataires(['alice@acme.fr', 'ext@autre.com', 'Comité des risques', ' bob@acme.fr '], membres)
    expect(r).toEqual([
      { nom: 'alice@acme.fr', email: 'Alice@Acme.fr', locale: 'en', statut: 'A_ENVOYER' },
      { nom: 'ext@autre.com', statut: 'HORS_ORGANISATION' },
      { nom: 'Comité des risques', statut: 'NOM' },
      { nom: 'bob@acme.fr', email: 'bob@acme.fr', locale: null, statut: 'A_ENVOYER' },
    ])
  })
  it('dédoublonne et borne à 20 entrées', () => {
    expect(classerDestinataires(['bob@acme.fr', 'BOB@acme.fr'], membres)).toHaveLength(1)
    expect(classerDestinataires(Array.from({ length: 30 }, (_, i) => `Nom ${i}`), membres)).toHaveLength(20)
  })
})

describe('rapportDiffusionEmail', () => {
  it('localisé, avec lien vers l’édition (le contenu ne circule pas par e-mail)', () => {
    const fr = rapportDiffusionEmail('fr', { titre: 'Tableau de bord incidents', periode: '2026-07-01 → 2026-09-30', lien: 'https://acra.test/rapports/e1' })
    expect(fr.subject).toContain('Tableau de bord incidents')
    expect(fr.text).toContain('https://acra.test/rapports/e1')
    expect(rapportDiffusionEmail('de', { titre: 'T', periode: 'P', lien: 'L' }).subject).toMatch(/Bericht/)
    expect(rapportDiffusionEmail('xx', { titre: 'T', periode: 'P', lien: 'L' }).subject).toBe(rapportDiffusionEmail('fr', { titre: 'T', periode: 'P', lien: 'L' }).subject)
  })
})
