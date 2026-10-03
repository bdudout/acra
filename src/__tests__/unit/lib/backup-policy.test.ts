// Planification des sauvegardes : fréquences journalière / hebdomadaire / mensuelle, conservation, estimation de l'espace.
import { describe, it, expect } from 'vitest'
import { DEFAULT_BACKUP_POLICY, parseBackupPolicy, validateBackupPolicy, estimateStorage, diskAdvice, policyAdvice, nextRuns, GB } from '@/lib/backup-policy'

describe('défauts', () => {
  it('une fois par jour, par semaine et par mois ; 3 copies de chaque fréquence', () => {
    expect(DEFAULT_BACKUP_POLICY).toMatchObject({ daily: { enabled: true, keep: 3 }, weekly: { enabled: true, keep: 3 }, monthly: { enabled: true, keep: 3 } })
    expect(DEFAULT_BACKUP_POLICY.hour).toBe(2)
  })
})

describe('parseBackupPolicy / validateBackupPolicy', () => {
  it('fichier absent ou invalide : défauts', () => {
    expect(parseBackupPolicy(null)).toEqual(DEFAULT_BACKUP_POLICY)
    expect(parseBackupPolicy({ schema: 9 })).toEqual(DEFAULT_BACKUP_POLICY)
  })
  it('lit une politique partielle et complète avec les défauts', () => {
    const p = parseBackupPolicy({ schema: 1, daily: { enabled: false, keep: 5 }, hour: 4 })
    expect(p.daily).toEqual({ enabled: false, keep: 5 }); expect(p.weekly).toEqual(DEFAULT_BACKUP_POLICY.weekly); expect(p.hour).toBe(4)
  })
  it('borne les valeurs : keep 1..60, heure 0..23, jour de semaine 0..6, jour du mois 1..28', () => {
    const v = validateBackupPolicy({ daily: { enabled: true, keep: 0 }, weekly: { enabled: true, keep: 3, weekday: 7 }, monthly: { enabled: true, keep: 3, day: 31 }, hour: 24 })
    expect(v.ok).toBe(false)
    expect(v.errors).toEqual(expect.arrayContaining(['daily.keep', 'weekly.weekday', 'monthly.day', 'hour']))
    expect(validateBackupPolicy({ daily: { enabled: true, keep: 60 }, weekly: { enabled: true, keep: 1, weekday: 6 }, monthly: { enabled: false, keep: 12, day: 28 }, hour: 0 }).ok).toBe(true)
  })
  it('au moins une fréquence active', () => {
    const none = { daily: { enabled: false, keep: 3 }, weekly: { enabled: false, keep: 3, weekday: 0 }, monthly: { enabled: false, keep: 3, day: 1 }, hour: 2 }
    expect(validateBackupPolicy(none).errors).toContain('frequencies')
  })
  it('types invalides rejetés', () => {
    expect(validateBackupPolicy({ daily: { enabled: 'oui', keep: '3' } } as never).ok).toBe(false)
    expect(validateBackupPolicy(null as never).ok).toBe(false)
  })
})

describe('estimateStorage', () => {
  const policy = DEFAULT_BACKUP_POLICY
  it('défauts : 9 points planifiés au plus, + points de mise à jour (dump + clone)', () => {
    const e = estimateStorage({ policy, pointBytes: 1 * GB, preUpdateKeep: 3, preUpdatePointBytes: 1 * GB, cloneBytes: 2 * GB })
    expect(e.scheduledPoints).toBe(9)
    expect(e.scheduledBytes).toBe(9 * GB)
    expect(e.preUpdateBytes).toBe(3 * 3 * GB)
    expect(e.totalBytes).toBe(18 * GB)
  })
  it('plus de conservation ⇒ plus d’espace ; une fréquence désactivée n’en prend pas', () => {
    const base = estimateStorage({ policy, pointBytes: GB, preUpdateKeep: 0, preUpdatePointBytes: 0, cloneBytes: 0 }).totalBytes
    const more = estimateStorage({ policy: { ...policy, daily: { enabled: true, keep: 7 } }, pointBytes: GB, preUpdateKeep: 0, preUpdatePointBytes: 0, cloneBytes: 0 }).totalBytes
    const less = estimateStorage({ policy: { ...policy, monthly: { ...policy.monthly, enabled: false } }, pointBytes: GB, preUpdateKeep: 0, preUpdatePointBytes: 0, cloneBytes: 0 }).totalBytes
    expect(more - base).toBe(4 * GB); expect(base - less).toBe(3 * GB)
  })
  it('un point partagé par plusieurs fréquences compte une fois : borne basse', () => {
    const e = estimateStorage({ policy, pointBytes: GB, preUpdateKeep: 0, preUpdatePointBytes: 0, cloneBytes: 0 })
    expect(e.scheduledPointsMin).toBeLessThan(e.scheduledPoints)
    expect(e.scheduledPointsMin).toBe(3)
  })
})

describe('diskAdvice', () => {
  it('OK : l’espace libre couvre largement le besoin', () => expect(diskAdvice({ freeBytes: 100 * GB, neededBytes: 18 * GB, usedByBackupsBytes: 0, pointBytes: GB }).status).toBe('OK'))
  it('WARN : l’espace libre ne couvre pas deux fois le besoin', () => expect(diskAdvice({ freeBytes: 25 * GB, neededBytes: 18 * GB, usedByBackupsBytes: 0, pointBytes: GB }).status).toBe('WARN'))
  it('CRITICAL : le besoin dépasse l’espace libre (ou il ne tient pas un point de plus)', () => {
    expect(diskAdvice({ freeBytes: 10 * GB, neededBytes: 18 * GB, usedByBackupsBytes: 0, pointBytes: GB }).status).toBe('CRITICAL')
    expect(diskAdvice({ freeBytes: GB / 2, neededBytes: GB, usedByBackupsBytes: GB, pointBytes: GB }).status).toBe('CRITICAL')
  })
  it('le besoin tient compte de l’espace déjà occupé par les sauvegardes', () => {
    expect(diskAdvice({ freeBytes: 12 * GB, neededBytes: 18 * GB, usedByBackupsBytes: 10 * GB, pointBytes: GB }).missingBytes).toBe(0)
    expect(diskAdvice({ freeBytes: 3 * GB, neededBytes: 18 * GB, usedByBackupsBytes: 10 * GB, pointBytes: GB }).missingBytes).toBe(5 * GB)
  })
  it('espace inconnu : UNKNOWN', () => expect(diskAdvice({ freeBytes: null, neededBytes: GB, usedByBackupsBytes: 0, pointBytes: GB }).status).toBe('UNKNOWN'))
})

describe('policyAdvice (bonnes pratiques)', () => {
  it('défauts 3/3/3 : conservation minimale signalée', () => {
    const a = policyAdvice(DEFAULT_BACKUP_POLICY)
    expect(a).toEqual(expect.arrayContaining(['daily_low', 'weekly_low', 'monthly_low']))
  })
  it('7 / 4 / 6 : aucune recommandation de conservation', () => {
    const p = { ...DEFAULT_BACKUP_POLICY, daily: { enabled: true, keep: 7 }, weekly: { enabled: true, keep: 4, weekday: 0 }, monthly: { enabled: true, keep: 6, day: 1 } }
    expect(policyAdvice(p)).toEqual([])
  })
  it('pas de sauvegarde quotidienne : signalé', () => {
    expect(policyAdvice({ ...DEFAULT_BACKUP_POLICY, daily: { enabled: false, keep: 3 } })).toContain('no_daily')
  })
})

describe('nextRuns', () => {
  const now = new Date('2026-10-04T10:00:00')  // dimanche
  it('prochaine exécution quotidienne : demain à l’heure choisie si l’heure est passée', () => {
    const r = nextRuns({ ...DEFAULT_BACKUP_POLICY, hour: 2 }, now)
    expect(r.daily?.getHours()).toBe(2); expect(r.daily!.getDate()).toBe(5)
  })
  it('hebdomadaire : prochain jour choisi ; mensuel : prochain jour du mois', () => {
    const r = nextRuns({ ...DEFAULT_BACKUP_POLICY, weekly: { enabled: true, keep: 3, weekday: 3 }, monthly: { enabled: true, keep: 3, day: 10 } }, now)
    expect(r.weekly!.getDay()).toBe(3); expect(r.monthly!.getDate()).toBe(10)
  })
  it('fréquence désactivée : null', () => expect(nextRuns({ ...DEFAULT_BACKUP_POLICY, weekly: { enabled: false, keep: 3, weekday: 0 } }, now).weekly).toBeNull())
})

import { parseBackupStats, backupOverview } from '@/lib/backup-policy'

describe('parseBackupStats', () => {
  const ok = { schema: 1, at: '2026-10-04T03:00:00Z', freeBytes: 50 * GB, backupsBytes: 4 * GB, points: 5, scheduledPoints: 3, lastScheduledPointBytes: GB, lastPreUpdatePointBytes: 2 * GB, dbBytes: 3 * GB, lastRunAt: '2026-10-04T02:00:05Z', lastCode: 0, lastTiers: 'daily,weekly' }
  it('lit les statistiques publiées par l’agent, assainies', () => {
    expect(parseBackupStats({ ...ok, extra: 'x' })).toEqual({ at: ok.at, freeBytes: 50 * GB, backupsBytes: 4 * GB, points: 5, scheduledPoints: 3, lastScheduledPointBytes: GB, lastPreUpdatePointBytes: 2 * GB, dbBytes: 3 * GB, lastRunAt: ok.lastRunAt, lastCode: 0, lastTiers: ['daily', 'weekly'] })
  })
  it('valeurs nulles ou invalides ⇒ null ; schéma inconnu ⇒ null', () => {
    const s = parseBackupStats({ ...ok, freeBytes: null, lastScheduledPointBytes: -1, lastCode: null, lastTiers: 'hourly,daily' })
    expect(s).toMatchObject({ freeBytes: null, lastScheduledPointBytes: null, lastCode: null, lastTiers: ['daily'] })
    expect(parseBackupStats({ ...ok, schema: 2 })).toBeNull()
    expect(parseBackupStats(null)).toBeNull()
  })
})

describe('backupOverview', () => {
  const stats = parseBackupStats({ schema: 1, at: '2026-10-04T03:00:00Z', freeBytes: 100 * GB, backupsBytes: 0, points: 0, scheduledPoints: 0, lastScheduledPointBytes: GB, lastPreUpdatePointBytes: GB, dbBytes: 2 * GB, lastRunAt: null, lastCode: null, lastTiers: '' })!
  it('combine politique, mesures et espace libre : estimation et verdict', () => {
    const o = backupOverview(DEFAULT_BACKUP_POLICY, stats)
    expect(o.estimate.scheduledPoints).toBe(9)
    expect(o.estimate.totalBytes).toBe(9 * GB + 3 * (GB + 2 * GB))
    expect(o.advice.status).toBe('OK')
  })
  it('sans mesure d’un point : estimation à partir de la base (≈ 40 %)', () => {
    const o = backupOverview(DEFAULT_BACKUP_POLICY, { ...stats, lastScheduledPointBytes: null, lastPreUpdatePointBytes: null })
    expect(o.pointBytes).toBeCloseTo(0.4 * 2 * GB, -3)
  })
  it('pas de statistiques : verdict UNKNOWN', () => {
    expect(backupOverview(DEFAULT_BACKUP_POLICY, null).advice.status).toBe('UNKNOWN')
  })
  it('plus de conservation ⇒ besoin plus élevé, verdict qui se dégrade', () => {
    const tight = { ...stats, freeBytes: 20 * GB }
    expect(backupOverview(DEFAULT_BACKUP_POLICY, tight).advice.status).toBe('WARN')
    const big = { ...DEFAULT_BACKUP_POLICY, daily: { enabled: true, keep: 30 } }
    expect(backupOverview(big, tight).advice.status).toBe('CRITICAL')
  })
})

import { formatBytes } from '@/lib/backup-policy'
describe('formatBytes', () => {
  it('Mo en dessous de 1 Go, Go au-dessus, décimales utiles', () => {
    expect(formatBytes(0, 'fr')).toBe('0 Mo')
    expect(formatBytes(512 * 1024 ** 2, 'fr')).toBe('512 Mo')
    expect(formatBytes(1.5 * GB, 'fr')).toBe('1,5 Go')
    expect(formatBytes(18 * GB, 'fr')).toBe('18 Go')
    expect(formatBytes(1.5 * GB, 'en')).toBe('1.5 GB')
    expect(formatBytes(2048 * GB, 'fr')).toBe('2,0 To')
  })
})
