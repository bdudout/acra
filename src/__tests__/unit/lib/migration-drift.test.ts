// Lot 4 — écart entre les migrations livrées dans l'image et celles appliquées en base.
import { describe, it, expect } from 'vitest'
import { migrationDrift } from '@/lib/migration-drift'

const done = (name: string) => ({ migration_name: name, finished_at: '2026-10-01T00:00:00Z', rolled_back_at: null })
describe('migrationDrift', () => {
  it('aucun écart : tout est appliqué', () => {
    expect(migrationDrift(['001_a', '002_b'], [done('001_a'), done('002_b')])).toEqual({ expected: 2, applied: 2, pending: [], failed: [] })
  })
  it('en attente : livrée mais jamais enregistrée', () => {
    expect(migrationDrift(['001_a', '002_b'], [done('001_a')])).toMatchObject({ pending: ['002_b'], failed: [] })
  })
  it('en échec : démarrée mais jamais terminée', () => {
    const r = migrationDrift(['001_a', '002_b'], [done('001_a'), { migration_name: '002_b', finished_at: null, rolled_back_at: null }])
    expect(r.failed).toEqual(['002_b']); expect(r.pending).toEqual([])
  })
  it('annulée (rolled back) puis rejouée : appliquée', () => {
    const r = migrationDrift(['001_a'], [{ migration_name: '001_a', finished_at: null, rolled_back_at: '2026-10-01T00:00:00Z' }, done('001_a')])
    expect(r).toMatchObject({ applied: 1, pending: [], failed: [] })
  })
  it('annulée seulement : en attente', () => {
    expect(migrationDrift(['001_a'], [{ migration_name: '001_a', finished_at: null, rolled_back_at: '2026-10-01T00:00:00Z' }]).pending).toEqual(['001_a'])
  })
  it('appliquée en base mais absente de l’image (base plus récente que le code) : ignorée, signalée à part', () => {
    const r = migrationDrift(['001_a'], [done('001_a'), done('999_future')])
    expect(r.pending).toEqual([]); expect(r.unknownInImage).toEqual(['999_future'])
  })
  it('tri stable et sans doublon', () => {
    expect(migrationDrift(['b', 'a', 'a'], []).pending).toEqual(['a', 'b'])
  })
})
