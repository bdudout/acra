import { describe, expect, it } from 'vitest'
import { colonnesChampsExport, champsPublics, type ChampDef } from '@/lib/champs-perso'
import { getTOrg } from '@/lib/i18n-org'

const defs: ChampDef[] = [
  { code: 'site', label: 'Site', type: 'TEXTE' },
  { code: 'crit', label: 'Critique', type: 'OUINON' },
  { code: 'secret', label: 'Réservé', type: 'TEXTE', roles: ['ADMIN'] },
]

describe('champs personnalisés dans les exports', () => {
  it('colonnes limitées aux champs accessibles au rôle ; valeurs typées, oui/non traduits', () => {
    const r = colonnesChampsExport(defs, { site: 'Lyon', crit: true, secret: 'x' }, 'RSSI', { oui: 'Oui', non: 'Non' })
    expect(r.entetes).toEqual(['Site', 'Critique'])
    expect(r.valeurs).toEqual(['Lyon', 'Oui'])
    const admin = colonnesChampsExport(defs, { secret: 's', crit: false }, 'ADMIN', { oui: 'Oui', non: 'Non' })
    expect(admin.entetes).toEqual(['Site', 'Critique', 'Réservé'])
    expect(admin.valeurs).toEqual(['', 'Non', 's'])
  })
  it('champs publics (sans restriction de rôle) : seuls admis dans un rapport figé partagé', () => {
    expect(champsPublics(defs).map(d => d.code)).toEqual(['site', 'crit'])
  })
})

describe('getTOrg — vocabulaire de l’organisation côté serveur', () => {
  it('applique le vocabulaire (exports, e-mails, PDF) ; sans vocabulaire, traductions livrées', () => {
    const t = getTOrg('fr', { incident: { '*': 'Événement de sécurité' } })
    expect(t.nav.incidents).toBe('Événement de sécurité')
    expect(getTOrg('fr', undefined).nav.incidents).not.toBe('Événement de sécurité')
    expect(getTOrg('xx', {}).nav.incidents).toBeTruthy()
  })
})
