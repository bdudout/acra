import { expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'

it('refuse un rôle lecteur avant la saisie du mot de passe et tout accès DB', () => {
  const result = spawnSync(process.execPath, ['scripts/create-admin.mjs', 'reader@example.test', 'LECTEUR'], {
    encoding: 'utf8', env: { ...process.env, ACRA_ADMIN_PASSWORD: '' },
  })
  expect(result.status).toBe(1)
  expect(result.stderr).toContain('Rôle invalide')
  expect(result.stderr).not.toContain('Mot de passe absent')
})
