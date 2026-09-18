import { it, expect } from 'vitest'
import { releaseInfo } from '@/lib/release-info'
it('identifie explicitement un build de développement et une image publiée', () => {
 expect(releaseInfo({})).toEqual({ version: 'development', revision: 'unknown' })
 expect(releaseInfo({ ACRA_VERSION: 'v1.0.0', ACRA_REVISION: 'abc' })).toEqual({ version: 'v1.0.0', revision: 'abc' })
})
