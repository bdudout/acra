/** POST /api/import (export ACRA JSON/CSV) : codes d'erreur stables et détails de localisation. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ session: vi.fn(), rl: vi.fn(), count: vi.fn(), create: vi.fn() }))
vi.mock('next-auth', () => ({ getServerSession: m.session }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: { analyse: { count: m.count, create: m.create } } }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rl, rateLimitHeaders: () => ({}), LIMIT_IMPORT: { limit: 10, windowMs: 3_600_000 } }))
import { POST } from '@/app/api/import/route'

const post = (body: unknown) => new NextRequest('http://x/api/import', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ user: { id: 'u1' } })
  m.rl.mockResolvedValue({ allowed: true, remaining: 5, resetAt: 0 })
  m.count.mockResolvedValue(0)
  m.create.mockResolvedValue({ id: 'a1', nom: 'Test (importé)' })
})

describe('POST /api/import', () => {
  it('JSON valide : analyse créée EN_COURS', async () => {
    const res = await POST(post({ format: 'json', data: '{"nom":"Test"}' }))
    expect(res.status).toBe(201)
    expect(m.create.mock.calls[0][0].data).toMatchObject({ nom: 'Test (importé)', statut: 'EN_COURS' })
  })
  it('JSON illisible : code json_invalid avec ligne, colonne, extrait et cause probable', async () => {
    const res = await POST(post({ format: 'json', data: '{\n "nom": "A",\n}' }))
    expect(res.status).toBe(422)
    const j = await res.json()
    expect(j.error).toBe('json_invalid')
    expect(j.details).toMatchObject({ line: 3, hint: 'trailing_comma' })
    expect(m.create).not.toHaveBeenCalled()
  })
  it('vide, page web, tableau, sans nom : un code distinct chacun', async () => {
    const code = async (data: string) => (await (await POST(post({ format: 'json', data }))).json()).error
    expect(await code('   ')).toBe('import_file_empty')
    expect(await code('<html><body>x</body></html>')).toBe('json_html')
    expect(await code('[1,2]')).toBe('json_not_object')
    expect(await code('{"organisation":"X"}')).toBe('json_missing_name')
  })
  it('CSV sans section ACRA : csv_not_acra (aucune analyse vide créée)', async () => {
    const res = await POST(post({ format: 'csv', data: 'a;b\n1;2' }))
    expect((await res.json()).error).toBe('csv_not_acra')
    expect(m.create).not.toHaveBeenCalled()
  })
  it('requête invalide, format inconnu, taille, débit', async () => {
    expect((await (await POST(post({ format: 'yaml', data: 'x' }))).json()).error).toBe('import_format_unsupported')
    expect((await (await POST(post({ format: 'json' }))).json()).error).toBe('import_request_invalid')
    expect((await POST(post({ format: 'json', data: 'x'.repeat(2 * 1024 * 1024 + 1) }))).status).toBe(413)
    m.rl.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0 })
    const r = await POST(post({ format: 'json', data: '{}' }))
    expect(r.status).toBe(429)
    expect((await r.json()).error).toBe('import_rate_limited')
  })
})
