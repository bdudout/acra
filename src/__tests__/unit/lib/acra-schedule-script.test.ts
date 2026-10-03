// Planification des sauvegardes : scripts/acra-schedule.sh (tick, stats) — grand-père / père / fils.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { writeFileSync, readFileSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { makeInstance, type Instance } from '../../helpers/update-fixture'

vi.setConfig({ testTimeout: 180_000 })
let inst: Instance
afterEach(() => inst?.cleanup())
const make = () => makeInstance({ scripts: ['update.sh', 'acra-snapshot.sh', 'acra-offsite.sh', 'acra-schedule.sh'] })
const tick = (now: string, env: Record<string, string> = {}) => inst.run('scripts/acra-schedule.sh', ['tick'], { ACRA_SCHEDULE_NOW: now, ...env })
const points = () => { try { return readdirSync(path.join(inst.work, 'backups')).filter(x => /scheduled/.test(x)).sort() } catch { return [] as string[] } }
const manifest = (id: string) => JSON.parse(readFileSync(path.join(inst.work, 'backups', id, 'manifest.json'), 'utf8'))
const stats = () => JSON.parse(inst.read('.acra-update/backup-stats.json'))
const policy = (o: { daily?: [boolean, number]; weekly?: [boolean, number, number]; monthly?: [boolean, number, number]; hour?: number }) => {
  const d = o.daily ?? [true, 3], w = o.weekly ?? [true, 3, 0], m = o.monthly ?? [true, 3, 1]
  mkdirSync(path.join(inst.work, '.acra-update'), { recursive: true })
  writeFileSync(path.join(inst.work, '.acra-update/backup-policy.json'), `{\n  "schema": 1,\n  "daily": { "enabled": ${d[0]}, "keep": ${d[1]} },\n  "weekly": { "enabled": ${w[0]}, "keep": ${w[1]}, "weekday": ${w[2]} },\n  "monthly": { "enabled": ${m[0]}, "keep": ${m[1]}, "day": ${m[2]} },\n  "hour": ${o.hour ?? 2}\n}\n`)
}
const tiers = (id: string) => manifest(id).tiers.split(',').sort().join(',')

describe('acra-schedule tick — décision', () => {
  it('défauts, dimanche 2026-10-04 à 03 h : UN seul point sert les trois fréquences, sans clone, vérification complète', () => {
    inst = make()
    const r = tick('2026-10-04 03')
    expect(r.status, r.stderr).toBe(0)
    const p = points()
    expect(p).toHaveLength(1)
    expect(tiers(p[0])).toBe('daily,monthly,weekly')
    expect(manifest(p[0])).toMatchObject({ reason: 'scheduled', scheduledFor: '2026-10-04', verification: { level: 'full' } })
    expect(manifest(p[0]).database.clone).toBeNull()
    expect(inst.calls().some(c => c.includes('CREATE DATABASE') && c.includes('__snap_'))).toBe(false)
  })

  it('avant l’heure choisie : rien ; le même jour, un second passage ne recrée rien', () => {
    inst = make()
    tick('2026-10-04 01'); expect(points()).toEqual([])
    tick('2026-10-04 03'); expect(points()).toHaveLength(1)
    tick('2026-10-04 15'); expect(points()).toHaveLength(1)
  })

  it('lendemain : quotidien seul (vérification rapide) ; 7 jours après : quotidien + hebdomadaire ; mois suivant : mensuel', () => {
    inst = make()
    tick('2026-10-04 03')
    tick('2026-10-05 03')
    const lundi = points()[1]; expect(tiers(lundi)).toBe('daily'); expect(manifest(lundi).verification.level).toBe('quick')
    for (const d of ['06', '07', '08', '09', '10']) tick(`2026-10-${d} 03`)
    tick('2026-10-11 03')
    expect(tiers(points().at(-1)!)).toBe('daily,weekly')
    tick('2026-11-01 03')
    expect(tiers(points().at(-1)!)).toContain('monthly')
  })

  it('politique personnalisée : quotidien désactivé, hebdomadaire le mercredi, mensuel le 10, à 04 h', () => {
    inst = make(); policy({ daily: [false, 3], weekly: [true, 3, 3], monthly: [true, 3, 10], hour: 4 })
    tick('2026-10-04 05'); expect(points()).toEqual([])           // dimanche 4 : ni mercredi, ni le 10
    tick('2026-10-07 03'); expect(points()).toEqual([])           // mercredi mais avant 04 h
    tick('2026-10-07 05'); expect(tiers(points()[0])).toBe('weekly')
    tick('2026-10-10 05'); expect(tiers(points()[1])).toBe('monthly')
  })

  it('rétention : chaque fréquence ne garde que ses N copies (quotidien 2, hebdomadaire et mensuel désactivés)', () => {
    inst = make(); policy({ daily: [true, 2], weekly: [false, 3, 0], monthly: [false, 3, 1] })
    for (const d of ['01', '02', '03', '04', '05']) tick(`2026-10-${d} 03`)
    expect(points()).toHaveLength(2)
    expect(points().map(id => manifest(id).scheduledFor)).toEqual(['2026-10-04', '2026-10-05'])
  })

  it('3 copies de chaque fréquence par défaut', () => {
    inst = make()
    for (let d = 1; d <= 9; d++) tick(`2026-10-${String(d).padStart(2, '0')} 03`)
    const dates = points().map(id => manifest(id).scheduledFor)
    // les 3 jours les plus récents sont conservés ; un point plus ancien ne survit que s'il sert encore une fréquence hebdomadaire ou mensuelle
    expect(dates).toEqual(expect.arrayContaining(['2026-10-07', '2026-10-08', '2026-10-09']))
    expect(dates.length).toBeLessThanOrEqual(9)
    expect(dates).not.toContain('2026-10-02')
  })
})

describe('acra-schedule tick — garde-fous', () => {
  it('rien pendant une mise à jour (journal ou verrou d’exécution vivant)', () => {
    inst = make(); mkdirSync(path.join(inst.work, '.acra-update/run'), { recursive: true })
    writeFileSync(path.join(inst.work, '.acra-update/run/current.json'), '{}')
    expect(tick('2026-10-04 03').status).toBe(0)
    expect(points()).toEqual([])
  })

  it('après un échec : code publié, pas de nouvelle tentative avant le délai', () => {
    inst = make(); inst.fakeFile('dump_fail')
    const r = tick('2026-10-04 03')
    expect(r.status).not.toBe(0)
    expect(stats()).toMatchObject({ lastCode: 20, lastTiers: 'daily,weekly,monthly' })
    const before = inst.calls().length
    expect(tick('2026-10-04 03').status).toBe(0)
    expect(inst.calls().length).toBe(before)
    expect(points()).toEqual([])
  })

  it('délai de reprise à 0 : la sauvegarde est retentée', () => {
    inst = make(); inst.fakeFile('dump_fail')
    tick('2026-10-04 03')
    const f = path.join(inst.fake, 'dump_fail'); writeFileSync(f, '1'); readFileSync(f)
    inst.run('scripts/acra-schedule.sh', ['tick'], { ACRA_SCHEDULE_NOW: '2026-10-04 03', ACRA_SCHEDULE_RETRY_MINUTES: '0' })
    expect(inst.calls().filter(c => c.includes('pg_dump')).length).toBeGreaterThan(1)
  })

  it('verrou de passage détenu par un autre processus vivant : passage ignoré', () => {
    inst = make(); mkdirSync(path.join(inst.work, '.acra-update/.schedule-lock'), { recursive: true })
    writeFileSync(path.join(inst.work, '.acra-update/.schedule-lock/pid'), String(process.pid))
    expect(tick('2026-10-04 03').status).toBe(0)
    expect(points()).toEqual([])
  })
})

describe('acra-schedule stats', () => {
  it('publie espace libre, espace occupé, taille d’un point planifié et dernier passage', () => {
    inst = make(); inst.fakeFile('df_host', '5000000')
    tick('2026-10-04 03')
    const s = stats()
    expect(s.schema).toBe(1)
    expect(s.freeBytes).toBe(5000000 * 1024)
    expect(s.points).toBe(1); expect(s.scheduledPoints).toBe(1)
    expect(s.lastScheduledPointBytes).toBeGreaterThan(0)
    expect(s.backupsBytes).toBeGreaterThan(0)
    expect(s.lastCode).toBe(0)
    expect(JSON.stringify(s)).not.toMatch(/\/tmp|backups\//)
  })
  it('stats sans point : valeurs nulles, sans erreur', () => {
    inst = make()
    expect(inst.run('scripts/acra-schedule.sh', ['stats']).status).toBe(0)
    expect(stats()).toMatchObject({ points: 0, scheduledPoints: 0, lastScheduledPointBytes: null })
  })
})
