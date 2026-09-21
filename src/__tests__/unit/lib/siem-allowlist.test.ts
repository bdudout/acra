/**
 * Allowlist réseau des destinations SIEM (défense SSRF) — logique pure.
 */
import { describe, it, expect } from 'vitest'
import { parseSiemAllowlist, isSiemDestinationAllowed } from '@/lib/siem'

describe('parseSiemAllowlist', () => {
  it('vide / absente → []', () => {
    expect(parseSiemAllowlist(undefined)).toEqual([])
    expect(parseSiemAllowlist('')).toEqual([])
    expect(parseSiemAllowlist('   ')).toEqual([])
  })
  it('sépare sur virgules et espaces, trim', () => {
    expect(parseSiemAllowlist('siem.interne, 10.0.0.0/8   splunk')).toEqual(['siem.interne', '10.0.0.0/8', 'splunk'])
  })
})

describe('isSiemDestinationAllowed', () => {
  it('allowlist VIDE → non restreint (tout autorisé, rétrocompatible)', () => {
    expect(isSiemDestinationAllowed('https://n-importe-quoi.example', [])).toBe(true)
    expect(isSiemDestinationAllowed('http://10.1.2.3:8088/hec', [])).toBe(true)
  })

  it('hôte exact (insensible à la casse)', () => {
    const al = ['siem.interne']
    expect(isSiemDestinationAllowed('https://siem.interne:8088/services', al)).toBe(true)
    expect(isSiemDestinationAllowed('https://SIEM.Interne/services', al)).toBe(true)
    expect(isSiemDestinationAllowed('https://autre.interne/services', al)).toBe(false)
    // pas de correspondance de sous-chaîne : « evil-siem.interne » ≠ « siem.interne »
    expect(isSiemDestinationAllowed('https://evil-siem.interne/x', al)).toBe(false)
  })

  it('CIDR IPv4', () => {
    const al = ['10.0.0.0/8']
    expect(isSiemDestinationAllowed('http://10.42.7.9:8088/hec', al)).toBe(true)
    expect(isSiemDestinationAllowed('http://11.0.0.1/hec', al)).toBe(false)
    // /32 = hôte unique
    expect(isSiemDestinationAllowed('http://192.168.1.5/x', ['192.168.1.5/32'])).toBe(true)
    expect(isSiemDestinationAllowed('http://192.168.1.6/x', ['192.168.1.5/32'])).toBe(false)
  })

  it('mélange hôte + CIDR ; refuse hors allowlist', () => {
    const al = ['splunk.corp', '172.16.0.0/12']
    expect(isSiemDestinationAllowed('https://splunk.corp/hec', al)).toBe(true)
    expect(isSiemDestinationAllowed('http://172.20.5.5:8088/hec', al)).toBe(true)
    expect(isSiemDestinationAllowed('http://169.254.169.254/latest/meta-data', al)).toBe(false) // SSRF cloud métadonnées → refusé
  })

  it('URL invalide → refusée', () => {
    expect(isSiemDestinationAllowed('pas-une-url', ['siem.interne'])).toBe(false)
  })
})
