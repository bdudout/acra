import { describe, it, expect } from 'vitest'
import { resolveBranding } from '@/lib/branding'

const DEF = { nom: 'ACRA', baseline: 'Augmented Cyber Risk Analysis' }

describe('resolveBranding', () => {
  it('sans configuration → défauts', () => {
    expect(resolveBranding(null, DEF)).toEqual(DEF)
    expect(resolveBranding({}, DEF)).toEqual(DEF)
    expect(resolveBranding({ appName: '', appBaseline: '   ' }, DEF)).toEqual(DEF)
  })
  it('valeurs de configuration → priment sur les défauts', () => {
    expect(resolveBranding({ appName: 'RiskHub', appBaseline: 'GRC unifié' }, DEF))
      .toEqual({ nom: 'RiskHub', baseline: 'GRC unifié' })
  })
  it('surcharge partielle : le nom seul, la baseline reste au défaut', () => {
    expect(resolveBranding({ appName: 'RiskHub' }, DEF))
      .toEqual({ nom: 'RiskHub', baseline: DEF.baseline })
  })
  it('trim les valeurs de configuration', () => {
    expect(resolveBranding({ appName: '  RiskHub  ' }, DEF).nom).toBe('RiskHub')
  })
})
