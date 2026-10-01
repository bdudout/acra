import { describe, it, expect, vi, beforeEach } from 'vitest'

const lookup = vi.hoisted(() => vi.fn())
vi.mock('node:dns', () => ({ default: { lookup }, lookup }))

import { safeHttpsRequest, resolvePublicAddress } from '@/lib/safe-fetch.server'

const answer = (...addrs: string[]) => lookup.mockImplementation((...args: unknown[]) => {
  const cb = args[args.length - 1] as (e: null, a: { address: string; family: number }[]) => void
  if (typeof cb !== 'function') return
  cb(null, addrs.map(address => ({ address, family: address.includes(':') ? 6 : 4 })))
})

describe('safeHttpsRequest — anti-SSRF au niveau socket (N02/N03)', () => {
  beforeEach(() => lookup.mockReset())

  it.each(['http://hooks.example.com/', 'https://localhost./', 'https://[::ffff:7f00:1]/', 'https://u:p@hooks.example.com/', 'pas une url'])('refuse %s avant toute résolution', async url => {
    await expect(safeHttpsRequest(url)).rejects.toThrow('url_non_autorisee')
    expect(lookup).not.toHaveBeenCalled()
  })

  it('refuse un nom public dont le DNS pointe vers une IP privée (rebinding / DNS interne)', async () => {
    answer('10.0.0.5')
    await expect(safeHttpsRequest('https://rebind.example.com/')).rejects.toThrow('url_resout_ip_privee')
  })

  it('refuse si UNE seule des adresses résolues est privée', async () => {
    answer('93.184.216.34', '::ffff:a9fe:a9fe')
    await expect(safeHttpsRequest('https://mixte.example.com/')).rejects.toThrow('url_resout_ip_privee')
  })

  it('resolvePublicAddress renvoie l\'IP publique validée, refuse le reste', async () => {
    answer('93.184.216.34')
    await expect(resolvePublicAddress('ldap.example.com')).resolves.toBe('93.184.216.34')
    answer('127.0.0.1')
    await expect(resolvePublicAddress('ldap.example.com')).rejects.toThrow('url_resout_ip_privee')
  })
})
