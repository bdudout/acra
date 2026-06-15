import { describe, it, expect } from 'vitest'
import { parseUsersCsv } from '@/lib/users-csv'

describe('parseUsersCsv', () => {
  it('parse les lignes nom,prenom,email,role et combine le nom', () => {
    const rows = parseUsersCsv('Dupont,Marie,marie@ex.com,ANALYSTE')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ nom: 'Dupont', prenom: 'Marie', email: 'marie@ex.com', role: 'ANALYSTE', name: 'Marie Dupont', valid: true })
  })

  it('ignore une ligne d’en-tête', () => {
    const rows = parseUsersCsv('nom,prenom,email,role\nDupont,Marie,marie@ex.com,RSSI')
    expect(rows).toHaveLength(1)
    expect(rows[0].email).toBe('marie@ex.com')
    expect(rows[0].role).toBe('RSSI')
  })

  it('rôle par défaut ANALYSTE si absent ou invalide', () => {
    const rows = parseUsersCsv('Dupont,Marie,marie@ex.com\nMartin,Paul,paul@ex.com,SORCIER')
    expect(rows[0].role).toBe('ANALYSTE')
    expect(rows[1].role).toBe('ANALYSTE')
  })

  it('normalise le rôle (casse + alias)', () => {
    const rows = parseUsersCsv('a,b,a@ex.com,analyste\nc,d,c@ex.com,Risk Manager\ne,f,e@ex.com,admin')
    expect(rows.map(r => r.role)).toEqual(['ANALYSTE', 'RISK_MANAGER', 'ADMIN'])
  })

  it('marque invalide une ligne sans e-mail valide', () => {
    const rows = parseUsersCsv('Dupont,Marie,pas-un-email,ADMIN')
    expect(rows[0].valid).toBe(false)
    expect(rows[0].error).toBeTruthy()
  })

  it('gère le séparateur point-virgule et les retours \\r\\n', () => {
    const rows = parseUsersCsv('Dupont;Marie;marie@ex.com;LECTEUR\r\nMartin;Paul;paul@ex.com;ADMIN')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ email: 'marie@ex.com', role: 'LECTEUR' })
    expect(rows[1].role).toBe('ADMIN')
  })

  it('ignore les lignes vides et trim les champs', () => {
    const rows = parseUsersCsv('\n  Dupont , Marie , marie@ex.com , ADMIN \n\n')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ nom: 'Dupont', prenom: 'Marie', email: 'marie@ex.com' })
  })

  it('marque en doublon une seconde occurrence du même e-mail', () => {
    const rows = parseUsersCsv('a,b,dup@ex.com,ADMIN\nc,d,dup@ex.com,LECTEUR')
    expect(rows[0].valid).toBe(true)
    expect(rows[1].valid).toBe(false)
  })
})
