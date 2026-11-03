// Sauvegardes planifiées en profil « ha » et compte rendu à l'application (journal des tâches planifiées) :
// scripts/acra-schedule.sh — un seul planificateur effectif (bail en base), échecs signalés et relançables.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { makeInstance, type Instance } from '../../helpers/update-fixture'

vi.setConfig({ testTimeout: 180_000 })
let inst: Instance
afterEach(() => inst?.cleanup())
const make = () => makeInstance({ scripts: ['update.sh', 'acra-snapshot.sh', 'acra-offsite.sh', 'acra-schedule.sh'] })
const HA = { ACRA_DEPLOY_PROFILE: 'ha', DATABASE_URL: 'postgresql://app:pw@pg.example.org:5432/appdb', ACRA_PG_CLIENT: 'docker' }
const tick = (now: string, env: Record<string, string> = {}) => inst.run('scripts/acra-schedule.sh', ['tick'], { ACRA_SCHEDULE_NOW: now, ...env })
const points = () => { try { return readdirSync(path.join(inst.work, 'backups')).filter(x => /scheduled/.test(x)).sort() } catch { return [] as string[] } }
const reports = () => inst.calls().filter(c => c.includes('api/cron/sauvegarde-base'))

describe('acra-schedule — profil ha', () => {
  it('sauvegarde planifiée de la base externe : point créé, compte rendu OK envoyé à l’application', () => {
    inst = make()
    const r = tick('2026-10-04 03', HA)
    expect(r.status, r.stderr).toBe(0)
    expect(points()).toHaveLength(1)
    const rep = reports()
    expect(rep).toHaveLength(1)
    expect(rep[0]).toContain('"statut":"OK"'); expect(rep[0]).toContain('"raison":"scheduled"')
    expect(rep[0]).toContain(`"pointId":"${points()[0]}"`); expect(rep[0]).toContain('"controleDocuments":"ok"')
    expect(rep[0]).not.toContain('pw@')
  })

  it('sauvegarde du jour faite ou en cours sur un autre hôte : passage ignoré sans échec, plus rien ce jour-là', () => {
    inst = make(); inst.fakeFile('lease_held')
    const r = tick('2026-10-04 03', HA)
    expect(r.status, r.stderr).toBe(0)
    expect(points()).toEqual([])
    expect(reports()).toEqual([])
    expect(inst.read('.acra-update/schedule-skip').trim()).toBe('2026-10-04')
    const before = inst.calls().length
    expect(tick('2026-10-04 05', HA).status).toBe(0)
    expect(inst.calls().length).toBe(before)
    // Le lendemain, la planification reprend.
    rmSync(path.join(inst.fake, 'lease_held'))
    expect(tick('2026-10-05 03', HA).status).toBe(0)
    expect(points()).toHaveLength(1)
  })

  it('échec : compte rendu ECHEC avec le code (journal d’exécution, alerte, relance depuis l’administration)', () => {
    inst = make(); inst.fakeFile('dump_fail')
    const r = tick('2026-10-04 03', HA)
    expect(r.status).toBe(20)
    const rep = reports()
    expect(rep).toHaveLength(1)
    expect(rep[0]).toContain('"statut":"ECHEC"'); expect(rep[0]).toContain('"code":20')
  })

  it('application injoignable : le compte rendu est perdu mais la sauvegarde réussit', () => {
    inst = make(); inst.fakeFile('no_app')
    expect(tick('2026-10-04 03', HA).status).toBe(0)
    expect(points()).toHaveLength(1)
  })
})

describe('acra-schedule report', () => {
  it('mono-instance aussi : une sauvegarde planifiée réussie est rapportée', () => {
    inst = make()
    expect(tick('2026-10-04 03').status).toBe(0)
    expect(reports()).toHaveLength(1)
    expect(reports()[0]).toContain('"statut":"OK"')
  })

  it('report <code> <raison> [id] : sauvegarde manuelle de l’agent ; identifiant invalide écarté', () => {
    inst = make()
    expect(inst.run('scripts/acra-schedule.sh', ['report', '20', 'manual', 'x";rm -rf /']).status).toBe(0)
    const rep = reports()
    expect(rep).toHaveLength(1)
    expect(rep[0]).toContain('"statut":"ECHEC"'); expect(rep[0]).toContain('"code":20'); expect(rep[0]).toContain('"raison":"manual"')
    expect(rep[0]).toContain('"pointId":""')
    expect(inst.run('scripts/acra-schedule.sh', ['report', 'abc', 'hack']).status).toBe(2)
  })
})
