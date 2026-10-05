// Lot A de docs/specs/stockage-supervision-nettoyage.md : fonctions pures de supervision du stockage.
import { describe, it, expect } from 'vitest'
import { classifyUsage, deadTupleRatio, needsVacuum, projectFullDate, topTables, parseHostStats, parseDockerSize, validateThresholds, DEFAULT_THRESHOLDS } from '@/lib/storage-usage'

const GB = 1024 ** 3

describe('classifyUsage — seuils 80 / 90', () => {
  const c = (used: number) => classifyUsage(used, 100, DEFAULT_THRESHOLDS)
  it('bornes : 79 OK, 80 ATTENTION, 89 ATTENTION, 90 CRITIQUE', () => {
    expect(c(79).status).toBe('OK'); expect(c(80).status).toBe('WARN'); expect(c(89).status).toBe('WARN'); expect(c(90).status).toBe('CRITICAL'); expect(c(100).status).toBe('CRITICAL')
  })
  it('pourcentage arrondi, total inconnu ou nul → UNKNOWN', () => {
    expect(c(79.6).percent).toBe(80)
    expect(classifyUsage(10, 0, DEFAULT_THRESHOLDS).status).toBe('UNKNOWN')
    expect(classifyUsage(10, null, DEFAULT_THRESHOLDS).status).toBe('UNKNOWN')
  })
  it('seuils personnalisés ; incohérents (warn ≥ critical) → repli sur les défauts', () => {
    expect(classifyUsage(50, 100, { warnPercent: 40, criticalPercent: 60 }).status).toBe('WARN')
    expect(classifyUsage(85, 100, { warnPercent: 95, criticalPercent: 90 }).status).toBe('WARN')
  })
})

describe('lignes mortes', () => {
  it('ratio et signal VACUUM au-dessus de 20 %', () => {
    expect(deadTupleRatio(800, 200)).toBeCloseTo(0.2)
    expect(deadTupleRatio(0, 0)).toBe(0)
    expect(needsVacuum(800, 200)).toBe(false); expect(needsVacuum(700, 300)).toBe(true)
  })
})

describe('projectFullDate', () => {
  const day = 86400_000
  const now = new Date('2026-10-05T00:00:00Z')
  const series = (frees: number[]) => frees.map((f, i) => ({ at: new Date(now.getTime() - (frees.length - 1 - i) * day).toISOString(), freeBytes: f }))
  it('série décroissante : date de saturation par régression linéaire', () => {
    const r = projectFullDate(series([20, 19, 18, 17, 16, 15, 14, 13, 12, 11].map(x => x * GB)), now)
    expect(r).not.toBeNull()
    expect(Math.round((r!.getTime() - now.getTime()) / day)).toBe(11)
  })
  it('moins de 7 mesures, série plate ou croissante → null', () => {
    expect(projectFullDate(series([5, 4, 3, 2, 1, 1].map(x => x * GB)), now)).toBeNull()
    expect(projectFullDate(series(Array(10).fill(10 * GB)), now)).toBeNull()
    expect(projectFullDate(series([1, 2, 3, 4, 5, 6, 7].map(x => x * GB)), now)).toBeNull()
  })
  it('ignore les mesures invalides ; espace déjà nul → maintenant', () => {
    expect(projectFullDate([...series([7, 6, 5, 4, 3, 2, 1].map(x => x * GB)), { at: 'x', freeBytes: NaN }], now)).not.toBeNull()
    expect(projectFullDate(series([7, 6, 5, 4, 3, 2, 0].map(x => x * GB)), now)!.getTime()).toBeLessThanOrEqual(now.getTime() + day)
  })
})

describe('topTables', () => {
  it('trie par taille décroissante, borne à n, ajoute ratio et signal VACUUM', () => {
    const rows = [
      { name: 'A', totalBytes: 10, live: 100, dead: 0 }, { name: 'B', totalBytes: 50, live: 60, dead: 40 }, { name: 'C', totalBytes: 30, live: 1, dead: 0 },
    ]
    const t = topTables(rows, 2)
    expect(t.map(x => x.name)).toEqual(['B', 'C'])
    expect(t[0]).toMatchObject({ vacuum: true, deadRatio: 0.4 })
  })
})

describe('parseDockerSize', () => {
  it.each([['1.5GB', 1.5e9], ['500MB (45%)', 5e8], ['12kB', 12e3], ['0B', 0], ['2TB', 2e12]])('%s', (s, n) => expect(parseDockerSize(s)).toBe(n))
  it.each(['', 'abc', '-3GB', null, 12])('%s → null', s => expect(parseDockerSize(s as string)).toBeNull())
})

describe('parseHostStats', () => {
  const ok = { schema: 1, at: '2026-10-05T03:00:00Z', rows: [{ type: 'Images', size: '12GB', reclaimable: '4GB (33%)' }, { type: 'Build Cache', size: '3GB', reclaimable: '3GB' }, { type: 'Local Volumes', size: '8GB', reclaimable: '0B' }, { type: 'Containers', size: '1MB', reclaimable: '0B' }] }
  it('assainit : types connus uniquement, tailles en octets, champs inconnus ignorés', () => {
    const r = parseHostStats({ ...ok, evil: 'x', rows: [...ok.rows, { type: 'Secrets', size: '1GB', reclaimable: '1GB' }] })!
    expect(r.images).toEqual({ sizeBytes: 12e9, reclaimableBytes: 4e9 })
    expect(r.buildCache.reclaimableBytes).toBe(3e9); expect(r.volumes.sizeBytes).toBe(8e9)
    expect(r.reclaimableBytes).toBe(7e9)
    expect(JSON.stringify(r)).not.toContain('Secrets'); expect(JSON.stringify(r)).not.toContain('evil')
  })
  it('refuse schéma inconnu, date invalide, valeurs négatives, null', () => {
    expect(parseHostStats(null)).toBeNull(); expect(parseHostStats({ ...ok, schema: 2 })).toBeNull(); expect(parseHostStats({ ...ok, at: 'hier' })).toBeNull()
    expect(parseHostStats({ ...ok, rows: [{ type: 'Images', size: '-1GB', reclaimable: '0B' }] })!.images).toEqual({ sizeBytes: 0, reclaimableBytes: 0 })
  })
  it('borne le nombre de lignes lues', () => {
    expect(parseHostStats({ ...ok, rows: Array.from({ length: 5000 }, () => ok.rows[0]) })).not.toBeNull()
  })
})

describe('validateThresholds', () => {
  it('accepte 50 ≤ attention < critique ≤ 99 (entiers)', () => {
    expect(validateThresholds({ warnPercent: 80, criticalPercent: 90 })).toEqual({ ok: true, value: { warnPercent: 80, criticalPercent: 90 } })
    expect(validateThresholds({ warnPercent: '70', criticalPercent: 95 })).toEqual({ ok: true, value: { warnPercent: 70, criticalPercent: 95 } })
  })
  it.each([[{ warnPercent: 90, criticalPercent: 90 }], [{ warnPercent: 49, criticalPercent: 90 }], [{ warnPercent: 80, criticalPercent: 100 }], [{ warnPercent: 80.5, criticalPercent: 90 }], [{}], [null]])('refuse %j', v => {
    expect(validateThresholds(v).ok).toBe(false)
  })
})
