/** Champs personnalisés par module : définitions validées, valeurs typées, visibilité par rôle. */
import { describe, expect, it } from 'vitest'
import { CHAMPS_MODULES, MAX_CHAMPS_PAR_MODULE, sanitizeChampsConfig, sanitizeValeurs, valeursVisibles, champsRequisManquants, defsAccessibles, fusionnerChamps } from '@/lib/champs-perso'

const defs = sanitizeChampsConfig({
  incident: [
    { code: 'ref_ticket', label: 'Ticket ITSM', type: 'TEXTE' },
    { code: 'nb_clients', label: 'Clients touchés', type: 'NOMBRE', requis: true },
    { code: 'urgence', label: 'Urgence', type: 'LISTE', options: ['Basse', 'Haute'] },
    { code: 'date_comite', label: 'Date de comité', type: 'DATE' },
    { code: 'externe', label: 'Prestataire externe ?', type: 'OUINON' },
    { code: 'secret', label: 'Note confidentielle', type: 'TEXTE', roles: ['RSSI', 'ADMIN'] },
  ],
}).incident!

describe('sanitizeChampsConfig', () => {
  it('modules connus seulement ; codes valides et uniques ; types connus ; liste avec options', () => {
    expect(CHAMPS_MODULES).toEqual(['incident', 'controle', 'mission', 'constat'])
    const c = sanitizeChampsConfig({
      incident: [{ code: 'a b', label: 'x', type: 'TEXTE' }, { code: 'ok', label: '  Ok  ', type: 'TEXTE' }, { code: 'ok', label: 'dup', type: 'TEXTE' }, { code: 'l', label: 'Liste', type: 'LISTE', options: [] }, { code: 't', label: 'Type', type: 'BIZARRE' }],
      autre: [{ code: 'x', label: 'x', type: 'TEXTE' }],
    })
    expect(Object.keys(c)).toEqual(['incident'])
    expect(c.incident!.map(d => d.code)).toEqual(['ok'])
    expect(c.incident![0].label).toBe('Ok')
  })
  it('plafond de champs par module ; options bornées et dédupliquées ; rôles connus', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ code: `c${i}`, label: 'c', type: 'TEXTE' }))
    expect(sanitizeChampsConfig({ controle: many }).controle).toHaveLength(MAX_CHAMPS_PAR_MODULE)
    const l = sanitizeChampsConfig({ mission: [{ code: 'l', label: 'L', type: 'LISTE', options: ['A', 'A', ' B ', '', ...Array(50).fill('z').map((z, i) => z + i)], roles: ['RSSI', 'PIRATE'] }] }).mission![0]
    expect(l.options![0]).toBe('A'); expect(l.options![1]).toBe('B'); expect(l.options!.length).toBeLessThanOrEqual(20)
    expect(l.roles).toEqual(['RSSI'])
  })
})

describe('sanitizeValeurs', () => {
  it('ne garde que les champs définis, convertis selon leur type ; invalides écartés', () => {
    const v = sanitizeValeurs(defs, { ref_ticket: '  INC-42 ', nb_clients: '120', urgence: 'Haute', date_comite: '2026-10-05', externe: true, inconnu: 'x', secret: 'note' })
    expect(v).toEqual({ ref_ticket: 'INC-42', nb_clients: 120, urgence: 'Haute', date_comite: '2026-10-05', externe: true, secret: 'note' })
    expect(sanitizeValeurs(defs, { nb_clients: 'abc', urgence: 'Extrême', date_comite: 'nope', externe: 'oui' })).toEqual({})
    expect(sanitizeValeurs(defs, null)).toEqual({})
  })
  it('texte borné à 500 caractères', () => {
    expect(String(sanitizeValeurs(defs, { ref_ticket: 'x'.repeat(900) }).ref_ticket)).toHaveLength(500)
  })
})

describe('visibilité par rôle', () => {
  it('un champ restreint n’est ni lu ni écrit par un rôle non autorisé', () => {
    const valeurs = { ref_ticket: 'INC-42', secret: 'note' }
    expect(valeursVisibles(defs, valeurs, 'RSSI')).toEqual(valeurs)
    expect(valeursVisibles(defs, valeurs, 'ANALYSTE')).toEqual({ ref_ticket: 'INC-42' })
    expect(defsAccessibles(defs, 'ANALYSTE').map(d => d.code)).not.toContain('secret')
    expect(sanitizeValeurs(defsAccessibles(defs, 'ANALYSTE'), { secret: 'pirate' })).toEqual({})
  })
})

describe('champs requis', () => {
  it('liste les champs requis non renseignés (visibles par le rôle)', () => {
    expect(champsRequisManquants(defs, {}, 'ANALYSTE')).toEqual(['nb_clients'])
    expect(champsRequisManquants(defs, { nb_clients: 0 }, 'ANALYSTE')).toEqual([])
  })
})

describe('fusionnerChamps (écriture partielle sans écraser ce que le rôle ne voit pas)', () => {
  it('remplace les champs accessibles, conserve les champs réservés existants, permet d’effacer', () => {
    const existant = { ref_ticket: 'INC-1', nb_clients: 5, secret: 'confidentiel' }
    // ANALYSTE : ne voit pas « secret » ; il efface le ticket et corrige le nombre
    expect(fusionnerChamps(defs, existant, { nb_clients: 7, secret: 'pirate' }, 'ANALYSTE')).toEqual({ nb_clients: 7, secret: 'confidentiel' })
    // RSSI : peut modifier « secret »
    expect(fusionnerChamps(defs, existant, { ref_ticket: 'INC-1', secret: 'nouveau' }, 'RSSI')).toEqual({ ref_ticket: 'INC-1', secret: 'nouveau' })
  })
})

