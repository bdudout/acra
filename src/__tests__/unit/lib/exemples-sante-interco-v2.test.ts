import { describe, expect, it } from 'vitest'
import { sectorExemplesFor } from '@/lib/exemples-sectoriels'
import { EXT_ITEMS } from '@/lib/exemples-sectoriels-ext'
import { listSectorSuggestions, CATALOGUE_PACK_VERSION } from '@/lib/sector-suggestions'
import { CATALOGUE_CHANGELOG } from '@/lib/sector-suggestions-changelog'
import { readSectorExamplesTool } from '@/lib/mcp/tools-context.server'

const SANTE = 'Santé / Médico-social'
const TECH = 'Technique / Interconnexion de SI'
const all = (sec: string, sub: string) => JSON.stringify(['evenementsRedoutes', 'actionsElementaires', 'mesures', 'partiesPrenantes'].flatMap(c => sectorExemplesFor(sec, c as never, 'fr', sub)))

describe('contenu sectoriel — compléments (pièces jointes, intégrité, analyseurs, continuité, écosystème)', () => {
  it('portail : pièce jointe malveillante par la messagerie et intégrité du contenu des documents', () => {
    const p = all(SANTE, 'sante-portail')
    expect(p).toMatch(/pièce jointe malveillante/i)
    expect(p).toMatch(/intégrité du contenu|empreinte/i)
  })
  it('interconnexions : validation de schéma et analyseurs de fichiers durcis, dans les mesures communes', () => {
    const m = JSON.stringify(sectorExemplesFor(TECH, 'mesures', 'fr'))
    expect(m).toMatch(/schéma/i); expect(m).toMatch(/entités externes/i); expect(m).toMatch(/formules/i)
    expect(all(TECH, 'technique-interco-prestataire')).toMatch(/analyseur/i)
  })
  it('e-santé : test de continuité et de reprise de la plateforme', () => {
    expect(JSON.stringify(sectorExemplesFor(SANTE, 'mesures', 'fr', 'sante-esante'))).toMatch(/test du plan de continuité et de reprise de la plateforme/i)
  })
  it('écosystème : les personnes concernées et les autorités figurent parmi les parties prenantes', () => {
    for (const [sec, sub] of [[SANTE, 'sante-delegataire'], [SANTE, 'sante-amc'], [SANTE, 'sante-portail'], [TECH, 'technique-interco-metier']]) {
      const pp = sectorExemplesFor(sec, 'partiesPrenantes', 'fr', sub)
      expect(pp.some(x => x.type === 'ORGANISME_REGULATION'), `${sub} autorité`).toBe(true)
    }
    expect(JSON.stringify(sectorExemplesFor(SANTE, 'partiesPrenantes', 'fr', 'sante-delegataire'))).toMatch(/assurés|adhérents/i)
  })
  it('chaque action élémentaire de l’extension porte sa technique MITRE ATT&CK (identifiant bien formé)', () => {
    const ae = EXT_ITEMS.filter(x => x.category === 'actionsElementaires')
    expect(ae.length).toBeGreaterThan(20)
    for (const x of ae) expect(String(x.data.attack), JSON.stringify(x.data.nom)).toMatch(/^T\d{4}(\.\d{3})?$/)
    expect(sectorExemplesFor(SANTE, 'actionsElementaires', 'en', 'sante-portail')[0].attack).toMatch(/^T\d{4}/)
  })
})

describe('catalogue 1.13', () => {
  it('ajoute l’exploitation d’un analyseur de fichiers, sa revue de validation des entrées et le test de continuité d’une plateforme de santé', () => {
    const t = new Set(listSectorSuggestions('TECHNIQUE', 'fr').map(i => i.key))
    expect(t).toContain('technique.risk.parser-exploit'); expect(t).toContain('technique.control.input-validation-review')
    const s = new Set(listSectorSuggestions('SANTE', 'fr').map(i => i.key))
    expect(s).toContain('sante.control.platform-continuity-test'); expect(s).toContain('sante.risk.portal-malicious-attachment')
    expect(CATALOGUE_PACK_VERSION).toBe('1.13')
    expect(CATALOGUE_CHANGELOG.at(-1)!.added).toEqual(expect.arrayContaining(['technique.risk.parser-exploit', 'sante.control.platform-continuity-test']))
  })
})

describe('MCP read_sector_examples : consignes pour l’assistant', () => {
  it('rappelle que les exemples sont un socle à compléter (chaîne d’attaque, vecteurs techniques) et à restituer sans identifiants internes', async () => {
    const out = JSON.parse((await readSectorExamplesTool.handler({ secteur: 'santé', sousSecteur: 'sante-portail' }, { organizationId: 'o', keyId: 'k' })).content[0].text)
    expect(out.consignes).toMatch(/socle/i); expect(out.consignes).toMatch(/ATT&CK/); expect(out.consignes).toMatch(/identifiants internes/i)
  })
})
