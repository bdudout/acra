import { it, expect } from 'vitest'
import { validateManifest } from '../../../../scripts/release/manifest.mjs'
it('accepte seulement une stable et une image du dépôt épinglée par digest', () => {
 const data = { version: 'v1.0.0', revision: 'a'.repeat(40), image: `ghcr.io/bdudout/acra@sha256:${'b'.repeat(64)}`, migrationsHash: 'c'.repeat(64) }
 expect(validateManifest(data, 'v1.0.0')).toEqual(data)
 for (const patch of [{version: 'v1.0.0-rc.1'}, { image: 'ghcr.io/bdudout/acra:latest' }, { image: `evil@sha256:${'b'.repeat(64)}` }, { revision: '; rm -rf' }]) {
  expect(() => validateManifest({ ...data, ...patch }, 'v1.0.0')).toThrow()
 }
 expect(() => validateManifest(data, 'v1.0.1')).toThrow()
})
