// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

describe('identité de version du clone stable dans la recette Docker', () => {
  it('fournit le SHA stable par défaut tout en acceptant celui de la cible et du rollback', () => {
    const stableSha = '8091a509d85bcfa96efba61a4b4cb39f4c2bae05'
    const run = spawnSync('bash', [resolve('scripts/ci-update-identity.sh'), stableSha], { encoding: 'utf8' })
    expect(run.status, run.stderr).toBe(0)
    expect(run.stdout).toContain(`ACRA_REVISION: \${ACRA_REVISION:-${stableSha}}`)
    expect(run.stdout).toContain('ACRA_VERSION: ${ACRA_VERSION:-v1.0.4}')
  })

  it('rejette une révision invalide sans produire de configuration', () => {
    const run = spawnSync('bash', [resolve('scripts/ci-update-identity.sh'), '../autre'], { encoding: 'utf8' })
    expect(run.status).not.toBe(0)
    expect(run.stdout).toBe('')
  })
})
