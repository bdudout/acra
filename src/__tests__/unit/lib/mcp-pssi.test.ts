// MCP — proposition d'import d'une PSSI : référentiel personnalisé (exigences), document de la bibliothèque et suivi de
// conformité. Rien n'est créé avant l'acceptation par un administrateur.
import { describe, expect, it } from 'vitest'
import { isPssiProposalValid, pssiDocument, sanitizePssiProposal } from '@/lib/mcp/pssi-proposal'

const base = {
  titre: 'Politique de sécurité des systèmes d’information', code: 'pssi 2026', version: '3.2', date: '2026-06-30',
  description: 'PSSI validée par le comité de direction',
  texte: '# PSSI\n\n## 1. Gouvernance\nLe RSSI…',
  exigences: [
    { ref: 'GOV-01', nom: 'Désigner un RSSI', description: 'Un RSSI est nommé par la direction.', type: 'ORGANISATIONNELLE', categorie: 'Gouvernance' },
    { ref: 'ACC-01', nom: 'Authentification forte des administrateurs', type: 'TECHNOLOGIQUE', categorie: 'Accès' },
    { ref: 'GOV-01', nom: 'Doublon ignoré' },
    { nom: 'Sans référence ignorée' },
  ],
}

describe('sanitizePssiProposal', () => {
  it('référentiel de type PSSI : code normalisé, version, exigences dédupliquées (sans référence : ignorées)', () => {
    const p = sanitizePssiProposal(base)
    expect(p.referentiel).toMatchObject({ code: 'PSSI-2026', nom: 'Politique de sécurité des systèmes d’information', type: 'PSSI', version: '3.2' })
    expect(p.referentiel.exigences.map(e => e.ref)).toEqual(['GOV-01', 'ACC-01'])
    expect(p).toMatchObject({ date: '2026-06-30', suivreConformite: true })
    expect(isPssiProposalValid(p)).toBe(true)
  })
  it('code déduit du titre si absent ; suivi de conformité désactivable ; date invalide ignorée', () => {
    const p = sanitizePssiProposal({ ...base, code: undefined, suivreConformite: false, date: '30/06/2026' })
    expect(p.referentiel.code).toMatch(/^PSSI-/)
    expect(p.suivreConformite).toBe(false)
    expect(p.date).toBeNull()
  })
  it('invalide sans titre ou sans aucune exigence', () => {
    expect(isPssiProposalValid(sanitizePssiProposal({ ...base, titre: '' }))).toBe(false)
    expect(isPssiProposalValid(sanitizePssiProposal({ ...base, exigences: [] }))).toBe(false)
  })
  it('texte borné (200 000 caractères)', () => {
    expect(sanitizePssiProposal({ ...base, texte: 'x'.repeat(300_000) }).texte).toHaveLength(200_000)
  })
})

describe('pssiDocument — document Markdown de la bibliothèque', () => {
  it('texte fourni : en-tête (titre, version, date) puis le texte', () => {
    const d = pssiDocument(sanitizePssiProposal(base))
    expect(d.nom).toBe('PSSI-2026-v3.2.md')
    expect(d.contenu).toMatch(/^# Politique de sécurité des systèmes d’information\n/)
    expect(d.contenu).toContain('Version 3.2 · 2026-06-30')
    expect(d.contenu).toContain('## 1. Gouvernance')
  })
  it('sans texte : document reconstitué à partir des exigences, par catégorie', () => {
    const d = pssiDocument(sanitizePssiProposal({ ...base, texte: undefined }))
    expect(d.contenu).toContain('## Gouvernance')
    expect(d.contenu).toContain('**GOV-01** — Désigner un RSSI')
  })

  it('idempotent : un payload déjà assaini (stocké dans la proposition) est relu à l’identique à l’acceptation', () => {
    const p = sanitizePssiProposal({ titre: 'PSSI groupe', version: '3.2', date: '2026-01-15', suivreConformite: false, exigences: [{ ref: 'A-1', nom: 'Accès', categorie: 'Accès' }] })
    expect(sanitizePssiProposal(JSON.parse(JSON.stringify(p)))).toEqual(p)
  })
})
