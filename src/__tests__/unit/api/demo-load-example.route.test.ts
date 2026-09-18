import { it, expect, vi } from 'vitest'
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'reader', role: 'ADMIN' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: vi.fn(async () => ({ activeOrgId: 'org', role: 'LECTEUR' })) }))
vi.mock('@/lib/demo-server', () => ({ isDemoInstance: vi.fn(async () => true), touchOrgActivity: vi.fn(), getDemoConfig: vi.fn(async () => ({ maxAnalysesPerOrg: 50 })) }))
vi.mock('@/lib/demo-example', () => ({ createExampleAnalyse: vi.fn(async () => ({ id: 'a', alreadyExisted: true })) }))
vi.mock('@/lib/logger', () => ({ auditLog: vi.fn(), getClientIp: vi.fn() }))
import { POST } from '@/app/api/demo/load-example/route'
import { createExampleAnalyse } from '@/lib/demo-example'
it('refuse un lecteur même si son rôle instance est ADMIN', async () => {
 expect((await POST(new Request('http://localhost/api/demo/load-example', { method: 'POST' }))).status).toBe(403)
 expect(createExampleAnalyse).not.toHaveBeenCalled()
})
