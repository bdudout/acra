/** Charge un template esbuild sans le faire réécrire par Webpack/Turbopack.
 * Node >= 20.16 fournit getBuiltinModule ; les images utilisent Node 24 LTS.
 */
export function loadPdfRuntime(template: string): Record<string, (...args: unknown[]) => Promise<Buffer>> {
  if (!/^[a-z-]+$/.test(template)) throw new Error('Invalid PDF template')
  const nativeRequire = process.getBuiltinModule('module').createRequire(process.cwd() + '/package.json')
  return nativeRequire(process.cwd() + '/.pdf-runtime/' + template + '.cjs')
}
