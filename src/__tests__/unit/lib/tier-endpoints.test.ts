// Points d'accès d'un usage de service TIC : adresse normalisée, hôte extrait, types et environnements contrôlés.
// Sécurité : identifiants dans l'URL et schémas actifs refusés ; ACRA ne contacte jamais ces adresses.
import { describe, expect, it } from 'vitest'
import { lirePointAcces, normaliserAdresse } from '@/lib/tier-endpoints'

describe('normaliserAdresse', () => {
  it('URL complète : conservée (sans fragment), hôte en minuscules', () => {
    expect(normaliserAdresse('https://Acme.my.Salesforce.com/login?x=1#top')).toEqual({ ok: true, adresse: 'https://acme.my.salesforce.com/login?x=1', hote: 'acme.my.salesforce.com' })
  })
  it('nom d’hôte seul ou hôte:port : accepté', () => {
    expect(normaliserAdresse('sftp.banque-partenaire.fr')).toEqual({ ok: true, adresse: 'sftp.banque-partenaire.fr', hote: 'sftp.banque-partenaire.fr' })
    expect(normaliserAdresse('10.20.30.40:8443')).toEqual({ ok: true, adresse: '10.20.30.40:8443', hote: '10.20.30.40' })
  })
  it('schémas usuels acceptés (sftp, ftps, wss)', () => {
    expect(normaliserAdresse('sftp://files.example.com:22/in').ok).toBe(true)
    expect(normaliserAdresse('wss://stream.example.com').ok).toBe(true)
  })
  it('identifiants dans l’URL : refusés (jamais de secret dans le registre)', () => {
    expect(normaliserAdresse('https://user:secret@example.com')).toEqual({ ok: false, error: 'identifiants_interdits' })
  })
  it('schémas actifs ou inconnus : refusés', () => {
    expect(normaliserAdresse('javascript:alert(1)')).toEqual({ ok: false, error: 'adresse_invalide' })
    expect(normaliserAdresse('data:text/html,x')).toEqual({ ok: false, error: 'adresse_invalide' })
    expect(normaliserAdresse('gopher://x')).toEqual({ ok: false, error: 'adresse_invalide' })
  })
  it('vide, trop long ou espaces : refusé', () => {
    expect(normaliserAdresse('').ok).toBe(false)
    expect(normaliserAdresse('a b.com').ok).toBe(false)
    expect(normaliserAdresse('https://' + 'a'.repeat(2050) + '.com').ok).toBe(false)
  })
})

describe('lirePointAcces', () => {
  it('valeurs contrôlées ; facultatifs à null', () => {
    expect(lirePointAcces({ adresse: 'https://api.psp.example/v2', type: 'API', environnement: 'PRODUCTION' }))
      .toEqual({ ok: true, data: { adresse: 'https://api.psp.example/v2', hote: 'api.psp.example', type: 'API', environnement: 'PRODUCTION', authentification: null, commentaire: null } })
  })
  it('valeur inconnue refusée', () => {
    expect(lirePointAcces({ adresse: 'x.example.com', type: 'TELNET' })).toEqual({ ok: false, error: 'type_invalide' })
    expect(lirePointAcces({ adresse: 'x.example.com', type: 'WEB', environnement: 'DEV2' })).toEqual({ ok: false, error: 'environnement_invalide' })
    expect(lirePointAcces({ adresse: 'x.example.com', type: 'WEB', authentification: 'PIN' })).toEqual({ ok: false, error: 'authentification_invalide' })
  })
  it('commentaire borné', () => {
    expect(lirePointAcces({ adresse: 'x.example.com', type: 'WEB', commentaire: 'c'.repeat(1001) })).toEqual({ ok: false, error: 'commentaire_trop_long' })
  })
})
