// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest'
import { localStorage } from '../../../lib/document-storage'
import { rm, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

let dir = ''
afterAll(async () => { if (dir) await rm(dir, { recursive: true, force: true }) })

describe('localStorage (adaptateur volume local)', () => {
  it('écrit, relit puis supprime un fichier (round-trip)', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'acra-docs-'))
    const store = localStorage(dir)
    const key = 'org1/doc1/pssi.pdf'
    const payload = Buffer.from('%PDF-1.7 contenu de test', 'utf8')

    await store.put(key, payload)
    const back = await store.get(key)
    expect(back.equals(payload)).toBe(true)

    await store.delete(key)
    await expect(store.get(key)).rejects.toBeTruthy()
  })

  it('supprimer une clé absente est idempotent (pas d’erreur)', async () => {
    const store = localStorage(dir || tmpdir())
    await expect(store.delete('org1/inconnu/x.pdf')).resolves.toBeUndefined()
  })

  it('refuse une évasion de chemin (path traversal)', async () => {
    const store = localStorage(dir || tmpdir())
    await expect(store.put('../evasion.pdf', Buffer.from('x'))).rejects.toThrow('chemin_hors_racine')
  })
})
