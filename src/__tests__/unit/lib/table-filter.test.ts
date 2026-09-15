import { describe, it, expect } from 'vitest'
import {
  distinctValues, applyColumnFilters, toggleColumnValue, onlyColumnValue,
  clearColumnFilter, isColumnFiltered, type ColumnFilters,
} from '@/lib/table-filter'

const rows = [
  { id: '1', origine: 'Risque', porteur: 'DSI' },
  { id: '2', origine: 'Conformité', porteur: 'RSSI' },
  { id: '3', origine: 'Risque', porteur: 'DSI' },
  { id: '4', origine: 'Audit', porteur: null },
]
const disp = (r: typeof rows[number], k: string) => (r as unknown as Record<string, unknown>)[k]

describe('table-filter', () => {
  it('distinctValues : valeurs uniques triées, sans vides', () => {
    expect(distinctValues(rows, r => r.origine)).toEqual(['Audit', 'Conformité', 'Risque'])
    expect(distinctValues(rows, r => r.porteur)).toEqual(['DSI', 'RSSI']) // null exclu
  })

  it('applyColumnFilters : ET entre colonnes ; absence = tout passe', () => {
    expect(applyColumnFilters(rows, {}, disp).map(r => r.id)).toEqual(['1', '2', '3', '4'])
    const f: ColumnFilters = { origine: new Set(['Risque']) }
    expect(applyColumnFilters(rows, f, disp).map(r => r.id)).toEqual(['1', '3'])
    const f2: ColumnFilters = { origine: new Set(['Risque']), porteur: new Set(['DSI']) }
    expect(applyColumnFilters(rows, f2, disp).map(r => r.id)).toEqual(['1', '3'])
  })

  it('toggleColumnValue : décocher filtre, tout recocher supprime la colonne', () => {
    const all = distinctValues(rows, r => r.origine) // 3 valeurs
    // décocher « Audit » → filtre { Conformité, Risque }
    const f1 = toggleColumnValue({}, 'origine', 'Audit', all)
    expect(isColumnFiltered(f1, 'origine')).toBe(true)
    expect([...f1.origine].sort()).toEqual(['Conformité', 'Risque'])
    // recocher « Audit » → toutes cochées → colonne retirée
    const f2 = toggleColumnValue(f1, 'origine', 'Audit', all)
    expect(isColumnFiltered(f2, 'origine')).toBe(false)
  })

  it('onlyColumnValue / clearColumnFilter', () => {
    const f = onlyColumnValue({}, 'origine', 'Risque')
    expect([...f.origine]).toEqual(['Risque'])
    expect(isColumnFiltered(clearColumnFilter(f, 'origine'), 'origine')).toBe(false)
  })
})
