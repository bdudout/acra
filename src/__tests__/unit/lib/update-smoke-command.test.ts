import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

describe('Smoke HTTP dans le conteneur Alpine', () => {
  it('utilise uniquement les options reconnues par BusyBox wget', () => {
    const script = readFileSync(path.join(process.cwd(), 'scripts/update-lib.sh'), 'utf8')
    expect(script).not.toContain('--max-redirect=0')
    expect(script).toContain("wget -S -q -O /dev/null")
  })
})
