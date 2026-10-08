// Scénarios de mise à jour (CI) — scénario 5 « kill -9 pendant MIGRATE puis reprise » : la panne simulée doit arrêter
// TOUT ce que la mise à jour a lancé (groupe de processus et conteneurs éphémères comme le migrateur), sinon des
// orphelins appliquent encore la migration après la restauration et la reprise échoue (instabilité observée sur #237 / #243).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const script = readFileSync('scripts/ci-update-rollback.sh', 'utf8')
const scenario5 = script.slice(script.indexOf('step "5.'))

describe('ci-update-rollback.sh — scénario 5', () => {
  it('lance la mise à jour dans son propre groupe de processus et tue le groupe entier', () => {
    expect(scenario5).toMatch(/setsid bash "\$SCRIPTS_DIR\/update\.sh"/)
    expect(scenario5).toMatch(/kill -9 -- "-\$\(cat "\$WORK\/upd\.pid"\)"/)
  })
  it('arrête aussi les conteneurs éphémères (compose run : migrateur) du projet avant la reprise', () => {
    expect(scenario5).toMatch(/label=com\.docker\.compose\.oneoff=True/)
    expect(scenario5.indexOf('oneoff=True')).toBeLessThan(scenario5.indexOf('update-agent.sh'))
  })
})
