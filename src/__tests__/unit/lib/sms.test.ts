import { describe, it, expect } from 'vitest'
import { isSmsUsable, buildTwilioRequest, type SmsConfig } from '@/lib/sms'

const FULL: SmsConfig = {
  provider: 'TWILIO',
  apiKey: 'ACxxxxxxxxxxxxxxxx',
  apiSecret: 'authtoken123',
  senderId: '+15550001111',
}

describe('sms — isSmsUsable', () => {
  it('vrai quand provider + clés + expéditeur sont présents', () => {
    expect(isSmsUsable(FULL)).toBe(true)
  })
  it('faux si un champ requis manque', () => {
    expect(isSmsUsable({ ...FULL, apiKey: null })).toBe(false)
    expect(isSmsUsable({ ...FULL, apiSecret: null })).toBe(false)
    expect(isSmsUsable({ ...FULL, senderId: null })).toBe(false)
    expect(isSmsUsable(null)).toBe(false)
  })
})

describe('sms — buildTwilioRequest', () => {
  it('construit l’URL, l’en-tête Basic et le corps form-urlencoded', () => {
    const r = buildTwilioRequest(FULL, '+15559998888', 'Code: 123456')
    expect(r.url).toBe('https://api.twilio.com/2010-04-01/Accounts/ACxxxxxxxxxxxxxxxx/Messages.json')
    expect(r.authHeader).toBe('Basic ' + Buffer.from('ACxxxxxxxxxxxxxxxx:authtoken123').toString('base64'))
    const params = new URLSearchParams(r.body)
    expect(params.get('From')).toBe('+15550001111')
    expect(params.get('To')).toBe('+15559998888')
    expect(params.get('Body')).toBe('Code: 123456')
  })
})
