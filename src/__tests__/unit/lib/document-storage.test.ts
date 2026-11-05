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

  it('head : taille d’un fichier présent, null s’il est absent (contrôle de cohérence base ↔ stockage)', async () => {
    const d = await mkdtemp(path.join(tmpdir(), 'acra-docs-head-'))
    try {
      const store = localStorage(d)
      await store.put('o/d/f.txt', Buffer.from('12345'))
      await expect(store.head!('o/d/f.txt')).resolves.toEqual({ size: 5 })
      await expect(store.head!('o/d/absent.txt')).resolves.toBeNull()
      await expect(store.head!('../x')).rejects.toThrow('chemin_hors_racine')
    } finally { await rm(d, { recursive: true, force: true }) }
  })

  it('refuse une évasion de chemin (path traversal)', async () => {
    const store = localStorage(dir || tmpdir())
    await expect(store.put('../evasion.pdf', Buffer.from('x'))).rejects.toThrow('chemin_hors_racine')
  })
})
