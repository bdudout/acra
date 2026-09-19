import { it, expect, vi } from 'vitest'
import { loadPdfRuntime } from '@/lib/pdf-runtime'
it('utilise le chargeur natif Node, sans faire transformer les templates par Next', () => {
 const render = () => 'pdf'
 const require = vi.fn(() => ({ render }))
 const createRequire = vi.fn(() => require)
 const spy = vi.spyOn(process, 'getBuiltinModule').mockReturnValue({ createRequire } as never)
 expect(loadPdfRuntime('pdf-template')).toEqual({ render })
 expect(require).toHaveBeenCalledWith(`${process.cwd()}/.pdf-runtime/pdf-template.cjs`)
 spy.mockRestore()
})
