import { describe, it, expect } from 'vitest'
import { redactSecrets } from '@/lib/audit-redact'

describe('redactSecrets — masquage des secrets avant journalisation (CWE-312/CWE-532)', () => {
  it('remplace les clés sensibles renseignées par [REDACTED]', () => {
    const input = { mfaEnabled: true, smsApiKey: 'AC123', smsApiSecret: 'shhh' }
    const out = redactSecrets(input, ['smsApiKey', 'smsApiSecret'])
    expect(out.smsApiKey).toBe('[REDACTED]')
    expect(out.smsApiSecret).toBe('[REDACTED]')
    expect(out.mfaEnabled).toBe(true)
  })

  it('laisse null/undefined tels quels (pas de faux secret journalisé)', () => {
    const out = redactSecrets({ smsApiKey: null, smsApiSecret: undefined }, ['smsApiKey', 'smsApiSecret'])
    expect(out.smsApiKey).toBeNull()
    expect(out.smsApiSecret).toBeUndefined()
  })

  it('ne mute pas l\'objet source (copie)', () => {
    const input = { smsApiSecret: 'shhh' }
    const out = redactSecrets(input, ['smsApiSecret'])
    expect(input.smsApiSecret).toBe('shhh')
    expect(out).not.toBe(input)
  })

  it('ignore les clés sensibles absentes (non renseignées) sans planter', () => {
    const input: { a: number; smsApiKey?: string } = { a: 1 }
    const out = redactSecrets(input, ['smsApiKey'])
    expect(out.a).toBe(1)
    expect(out.smsApiKey).toBeUndefined()
  })
})
