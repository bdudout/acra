import { it, expect } from 'vitest'
import { resolveDemoSeedPasswords } from '@/lib/demo-seed-policy'
const env = { ACRA_DEMO_MODE: 'true', ACRA_SEED_CONFIRM: 'DEMO_ONLY', ACRA_SEED_ANALYSTE_PASSWORD: 'Analyst-test-only-456!', ACRA_SEED_RSSI_PASSWORD: 'RSSI-test-only-789!', ACRA_SEED_DIRECTION_PASSWORD: 'Direction-test-only-123!' }
it('refuse toute cible non explicitement dédiée et tout secret manquant', () => {
 expect(() => resolveDemoSeedPasswords({ ...env, ACRA_DEMO_MODE: 'false' })).toThrow()
 expect(() => resolveDemoSeedPasswords({ ...env, ACRA_SEED_CONFIRM: '' })).toThrow()
 expect(() => resolveDemoSeedPasswords({ ...env, ACRA_SEED_RSSI_PASSWORD: '' })).toThrow()
})
it('exige des secrets distincts, robustes et uniquement des comptes métier', () => {
 expect(() => resolveDemoSeedPasswords({ ...env, ACRA_SEED_RSSI_PASSWORD: env.ACRA_SEED_ANALYSTE_PASSWORD })).toThrow()
 expect(Object.keys(resolveDemoSeedPasswords(env))).toEqual(['ANALYSTE', 'RSSI', 'DIRECTION_METIER'])
})
