// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { signV4, deriveSigningKey, s3ConfigFromEnv, s3Storage, s3ObjectUrl, encodeS3Path, EMPTY_SHA256 } from '@/lib/document-storage-s3'

// Identifiants d'EXEMPLE publiés par AWS dans sa documentation (non secrets).
const AK = 'AKIAIOSFODNN7EXAMPLE'
const SK = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'

describe('SigV4 — vecteurs de la documentation AWS', () => {
  it('« GET Object » (Amazon S3 API Reference, Signature Calculations for the Authorization Header, single chunk)', () => {
    // GET /test.txt sur examplebucket.s3.amazonaws.com, Range: bytes=0-9, 20130524T000000Z, us-east-1.
    const r = signV4({
      method: 'GET',
      url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'),
      headers: { range: 'bytes=0-9' },
      payloadHash: EMPTY_SHA256,
      accessKeyId: AK, secretAccessKey: SK, region: 'us-east-1', amzDate: '20130524T000000Z',
    })
    expect(r.canonicalRequest).toBe([
      'GET', '/test.txt', '',
      'host:examplebucket.s3.amazonaws.com', 'range:bytes=0-9',
      'x-amz-content-sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'x-amz-date:20130524T000000Z', '',
      'host;range;x-amz-content-sha256;x-amz-date',
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    ].join('\n'))
    expect(createHash('sha256').update(r.canonicalRequest).digest('hex')).toBe('7344ae5b7ee6c3e7e6b0fe0640412a37625d1fbfff95c48bbb2dc43964946972')
    expect(r.stringToSign).toBe('AWS4-HMAC-SHA256\n20130524T000000Z\n20130524/us-east-1/s3/aws4_request\n7344ae5b7ee6c3e7e6b0fe0640412a37625d1fbfff95c48bbb2dc43964946972')
    expect(r.signature).toBe('f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41')
    expect(r.headers.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,' +
      'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,' +
      'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41')
  })

  it('« PUT Object » (même page : test$file.text, Date, x-amz-storage-class, corps « Welcome to Amazon S3. »)', () => {
    const body = 'Welcome to Amazon S3.'
    const r = signV4({
      method: 'PUT',
      url: new URL('https://examplebucket.s3.amazonaws.com/' + encodeS3Path('test$file.text')),
      headers: { date: 'Fri, 24 May 2013 00:00:00 GMT', 'x-amz-storage-class': 'REDUCED_REDUNDANCY' },
      payloadHash: createHash('sha256').update(body).digest('hex'),
      accessKeyId: AK, secretAccessKey: SK, region: 'us-east-1', amzDate: '20130524T000000Z',
    })
    expect(r.canonicalRequest.split('\n')[1]).toBe('/test%24file.text')
    expect(r.signature).toBe('98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd')
  })

  it('clé de signature dérivée (AWS General Reference, exemple IAM 20120215)', () => {
    const k = deriveSigningKey('wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', '20120215', 'us-east-1', 'iam')
    expect(k.toString('hex')).toBe('f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d')
  })
})

describe('chemins et configuration', () => {
  it('encode chaque segment selon RFC 3986 (y compris !\'()*) sans encoder les « / »', () => {
    expect(encodeS3Path("org/doc/rapport (v2)*!'é.pdf")).toBe('org/doc/rapport%20%28v2%29%2A%21%27%C3%A9.pdf')
  })

  const base = { DOCUMENT_STORAGE: 's3', S3_ENDPOINT: 'https://s3.gra.io.cloud.ovh.net', S3_REGION: 'gra', S3_BUCKET: 'acra-docs', S3_ACCESS_KEY_ID: 'ak', S3_SECRET_ACCESS_KEY: 'sk' }

  it('lit la configuration ; style chemin par défaut ; SSE désactivé par défaut', () => {
    expect(s3ConfigFromEnv(base)).toMatchObject({ endpoint: 'https://s3.gra.io.cloud.ovh.net', region: 'gra', bucket: 'acra-docs', forcePathStyle: true, sse: null, prefix: '' })
    expect(s3ConfigFromEnv({ ...base, S3_SSE: 'AES256', S3_FORCE_PATH_STYLE: 'false', S3_PREFIX: 'acra/' })).toMatchObject({ sse: 'AES256', forcePathStyle: false, prefix: 'acra/' })
    expect(s3ConfigFromEnv({ ...base, S3_SSE: '1' }).sse).toBe('AES256')
  })

  it('variable manquante : erreur claire nommant la variable (jamais le secret)', () => {
    expect(() => s3ConfigFromEnv({ ...base, S3_BUCKET: '' })).toThrow(/S3_BUCKET/)
    expect(() => s3ConfigFromEnv({ ...base, S3_SECRET_ACCESS_KEY: undefined })).toThrow(/S3_SECRET_ACCESS_KEY/)
    expect(() => s3ConfigFromEnv({ ...base, S3_ENDPOINT: 'ftp://x' })).toThrow(/S3_ENDPOINT/)
    expect(() => s3ConfigFromEnv({ ...base, S3_SSE: 'aws:kms' })).toThrow(/S3_SSE/)
  })

  it('URL d’objet : style chemin ou hôte virtuel, préfixe appliqué', () => {
    const c = s3ConfigFromEnv({ ...base, S3_PREFIX: 'acra' })
    expect(s3ObjectUrl(c, 'org1/doc1/a.pdf').toString()).toBe('https://s3.gra.io.cloud.ovh.net/acra-docs/acra/org1/doc1/a.pdf')
    const v = s3ConfigFromEnv({ ...base, S3_FORCE_PATH_STYLE: '0' })
    expect(s3ObjectUrl(v, 'org1/doc1/a.pdf').toString()).toBe('https://acra-docs.s3.gra.io.cloud.ovh.net/org1/doc1/a.pdf')
  })

  it('refuse une clé vide, absolue ou contenant « .. »', () => {
    const c = s3ConfigFromEnv(base)
    expect(() => s3ObjectUrl(c, '')).toThrow(/cle_invalide/)
    expect(() => s3ObjectUrl(c, '/etc/passwd')).toThrow(/cle_invalide/)
    expect(() => s3ObjectUrl(c, 'org1/../org2/x')).toThrow(/cle_invalide/)
  })
})

describe('s3Storage — requêtes HTTP (fetch simulé)', () => {
  const env = { S3_ENDPOINT: 'https://s3.example.test', S3_REGION: 'fr-par', S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'ak', S3_SECRET_ACCESS_KEY: 'sk', S3_SSE: 'AES256' }

  it('put : PUT signé, empreinte SHA-256 du corps, Content-MD5, chiffrement serveur demandé', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    const st = s3Storage(env, fetchMock as unknown as typeof fetch)
    const bytes = Buffer.from('%PDF contenu')
    await st.put('org1/doc1/a.pdf', bytes, 'application/pdf')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://s3.example.test/b/org1/doc1/a.pdf')
    expect(init.method).toBe('PUT')
    const h = init.headers as Record<string, string>
    expect(h['x-amz-content-sha256']).toBe(createHash('sha256').update(bytes).digest('hex'))
    expect(h['content-md5']).toBe(createHash('md5').update(bytes).digest('base64'))
    expect(h['x-amz-server-side-encryption']).toBe('AES256')
    expect(h['content-type']).toBe('application/pdf')
    expect(h.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=ak\/\d{8}\/fr-par\/s3\/aws4_request,SignedHeaders=content-md5;content-type;host;x-amz-content-sha256;x-amz-date;x-amz-server-side-encryption,Signature=[0-9a-f]{64}$/)
  })

  it('put en échec : erreur avec le statut, sans corps de réponse brut', async () => {
    const st = s3Storage(env, (async () => new Response('<Error>secret detail</Error>', { status: 403 })) as unknown as typeof fetch)
    await expect(st.put('o/d/a', Buffer.from('x'))).rejects.toThrow('s3_put_echec:403')
  })

  it('get : rend les octets ; 404 → erreur ENOENT', async () => {
    const st = s3Storage(env, (async (u: string) => u.endsWith('/absent')
      ? new Response('', { status: 404 })
      : new Response(Buffer.from('abc'), { status: 200 })) as unknown as typeof fetch)
    expect((await st.get('o/d/ok')).toString()).toBe('abc')
    await expect(st.get('o/d/absent')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('delete : idempotent (204 ou 404 acceptés), autre statut → erreur', async () => {
    const statuses = [204, 404, 500]
    const st = s3Storage(env, (async () => new Response(null, { status: statuses.shift()! })) as unknown as typeof fetch)
    await expect(st.delete('o/d/a')).resolves.toBeUndefined()
    await expect(st.delete('o/d/a')).resolves.toBeUndefined()
    await expect(st.delete('o/d/a')).rejects.toThrow('s3_delete_echec:500')
  })

  it('head : taille de l’objet ou null s’il est absent', async () => {
    const statuses = [200, 404]
    const st = s3Storage(env, (async () => {
      const s = statuses.shift()!
      return new Response(null, { status: s, headers: s === 200 ? { 'content-length': '42' } : {} })
    }) as unknown as typeof fetch)
    expect(await st.head('o/d/a')).toEqual({ size: 42 })
    expect(await st.head('o/d/a')).toBeNull()
  })
})

describe('getDocumentStorage — sélection DOCUMENT_STORAGE=s3', () => {
  const env = { DOCUMENT_STORAGE: 's3', S3_ENDPOINT: 'https://s3.example.test', S3_REGION: 'fr-par', S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'ak', S3_SECRET_ACCESS_KEY: 'sk' }

  it('charge l’adaptateur S3 quand la configuration est complète', async () => {
    const { getDocumentStorage, resetDocumentStorageCache } = await import('@/lib/document-storage')
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
    resetDocumentStorageCache()
    try {
      const st = await getDocumentStorage()
      expect(typeof (st as { head?: unknown }).head).toBe('function')
    } finally { resetDocumentStorageCache(); vi.unstubAllEnvs() }
  })

  it('configuration incomplète : erreur nommant la variable, jamais de repli sur le disque local', async () => {
    const { getDocumentStorage, resetDocumentStorageCache } = await import('@/lib/document-storage')
    for (const [k, v] of Object.entries({ ...env, S3_BUCKET: '' })) vi.stubEnv(k, v)
    resetDocumentStorageCache()
    try {
      await expect(getDocumentStorage()).rejects.toThrow(/S3_BUCKET/)
    } finally { resetDocumentStorageCache(); vi.unstubAllEnvs() }
  })
})
