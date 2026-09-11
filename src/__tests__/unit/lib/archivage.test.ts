import { describe, it, expect } from 'vitest'
import { estArchivable, cleanArchivageDuree, ARCHIVAGE_DUREE_DEFAUT_ANNEES } from '@/lib/archivage'

const NOW = new Date('2026-09-10T00:00:00Z')
const il_y_a_ans = (n: number) => new Date(NOW.getTime() - n * 365.25 * 86_400_000).toISOString()

describe('cleanArchivageDuree', () => {
  it('borne 1..30, défaut si invalide', () => {
    expect(cleanArchivageDuree(5)).toBe(5)
    expect(cleanArchivageDuree('7')).toBe(7)
    expect(cleanArchivageDuree(0)).toBe(ARCHIVAGE_DUREE_DEFAUT_ANNEES)
    expect(cleanArchivageDuree(999)).toBe(30)
    expect(cleanArchivageDuree(null)).toBe(ARCHIVAGE_DUREE_DEFAUT_ANNEES)
  })
})

describe('estArchivable', () => {
  it('mission close, ancienne au-delà de la durée, sans constat ouvert → archivable', () => {
    expect(estArchivable({ statut: 'CLOTUREE', dateFin: il_y_a_ans(6), constatsOuverts: 0 }, NOW, 5)).toBe(true)
  })
  it('mission close mais récente → non archivable', () => {
    expect(estArchivable({ statut: 'CLOTUREE', dateFin: il_y_a_ans(2) }, NOW, 5)).toBe(false)
  })
  it('mission non close → non archivable', () => {
    expect(estArchivable({ statut: 'EN_COURS', dateFin: il_y_a_ans(6) }, NOW, 5)).toBe(false)
  })
  it('constats encore ouverts → non archivable même ancienne', () => {
    expect(estArchivable({ statut: 'CLOTUREE', dateFin: il_y_a_ans(6), constatsOuverts: 2 }, NOW, 5)).toBe(false)
  })
  it('déjà archivée → non archivable (idempotent)', () => {
    expect(estArchivable({ statut: 'CLOTUREE', dateFin: il_y_a_ans(6), archiveLe: il_y_a_ans(1) }, NOW, 5)).toBe(false)
  })
  it('sans date de fin → non archivable (âge indéterminé)', () => {
    expect(estArchivable({ statut: 'CLOTUREE', dateFin: null }, NOW, 5)).toBe(false)
  })
})
