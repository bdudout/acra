import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assertCronAuth, cronSecretMatches } from '@/lib/cron-auth'

function reqWith(headers: Record<string, string> = {}, url = 'https://acra.example/api/cron/x') {
  const h = new Headers(headers)
  // Objet minimal compatible avec assertCronAuth (headers.get + nextUrl).
  return { headers: h, nextUrl: new URL(url), url } as unknown as Parameters<typeof assertCronAuth>[0]
}

describe('cronSecretMatches (temps constant)', () => {
  it('vrai uniquement pour une correspondance exacte', () => {
    expect(cronSecretMatches('s3cret', 's3cret')).toBe(true)
    expect(cronSecretMatches('s3cret', 'other!')).toBe(false)
    expect(cronSecretMatches('', 's3cret')).toBe(false)
    expect(cronSecretMatches('court', 's3cret-plus-long')).toBe(false) // longueurs différentes
  })
})

describe('assertCronAuth', () => {
  const OLD = process.env.CRON_SECRET
  beforeEach(() => { process.env.CRON_SECRET = 'top-secret-value' })
  afterEach(() => { if (OLD === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = OLD })

  it('autorise via l\'en-tête Authorization: Bearer (retourne null)', () => {
    expect(assertCronAuth(reqWith({ authorization: 'Bearer top-secret-value' }))).toBeNull()
  })

  it('REJETTE le secret passé en query-string ?token= (CWE-598)', async () => {
    const res = assertCronAuth(reqWith({}, 'https://acra.example/api/cron/x?token=top-secret-value'))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(401)
  })

  it('401 si l\'en-tête ne correspond pas ou est absent', () => {
    expect(assertCronAuth(reqWith({ authorization: 'Bearer wrong' }))!.status).toBe(401)
    expect(assertCronAuth(reqWith({}))!.status).toBe(401)
  })

  it('fail-closed : 503 si CRON_SECRET absent', () => {
    delete process.env.CRON_SECRET
    expect(assertCronAuth(reqWith({ authorization: 'Bearer anything' }))!.status).toBe(503)
  })
})
