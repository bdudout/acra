import { describe, expect, it } from 'vitest'
import { elementsAssocies } from '@/lib/suggestions-associees'

const items = [
  { key: 'risk.a', kind: 'RISK' as const, processKey: 'process.p1' },
  { key: 'risk.b', kind: 'RISK' as const, processKey: 'process.p2' },
  { key: 'process.p1', kind: 'PROCESS' as const },
  { key: 'process.p2', kind: 'PROCESS' as const },
  { key: 'control.c1', kind: 'CONTROL' as const, processKey: 'process.p1', riskKeys: ['risk.a'] },
  { key: 'control.c2', kind: 'CONTROL' as const, processKey: 'process.p2', riskKeys: ['risk.b'] },
  { key: 'kri.k1', kind: 'KRI' as const, processKey: 'process.p1' },
  { key: 'audit.x', kind: 'AUDIT' as const, processKey: 'process.p1', riskKeys: ['risk.a', 'risk.b'] },
]

describe('importer aussi les éléments associés aux risques choisis', () => {
  it('rien par défaut', () => {
    expect(elementsAssocies(items, ['risk.a'], {})).toEqual([])
  })
  it('processus du risque, contrôles et audits qui le couvrent, KRI de son processus — selon les options cochées', () => {
    expect(elementsAssocies(items, ['risk.a'], { processus: true })).toEqual(['process.p1'])
    expect(elementsAssocies(items, ['risk.a'], { controles: true, audits: true })).toEqual(['control.c1', 'audit.x'])
    expect(elementsAssocies(items, ['risk.a'], { kri: true })).toEqual(['kri.k1'])
    expect(elementsAssocies(items, ['risk.a', 'risk.b'], { processus: true, controles: true, kri: true, audits: true }).sort())
      .toEqual(['audit.x', 'control.c1', 'control.c2', 'kri.k1', 'process.p1', 'process.p2'])
  })
  it('n’ajoute jamais un élément déjà importé', () => {
    expect(elementsAssocies(items, ['risk.a'], { processus: true }, new Set(['process.p1']))).toEqual([])
  })
})
