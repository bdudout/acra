import { describe, expect, it } from 'vitest'
import { getClientIp } from '@/lib/logger'

const request = (headers: Record<string, string>) => ({ headers: { get: (key: string) => headers[key] ?? null } })

describe('getClientIp', () => {
  it('uses the last hop appended by the trusted reverse proxy', () => {
    expect(getClientIp(request({ 'x-forwarded-for': 'spoofed, 203.0.113.42' }))).toBe('203.0.113.42')
  })
  it('falls back to x-real-ip', () => {
    expect(getClientIp(request({ 'x-real-ip': '203.0.113.42' }))).toBe('203.0.113.42')
  })
})
