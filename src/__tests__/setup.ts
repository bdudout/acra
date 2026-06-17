// Global test setup for Vitest
import '@testing-library/jest-dom'

// Polyfill localStorage : sous Node 26 + jsdom, `localStorage` global n'est pas
// exposé (Node introduit son propre localStorage expérimental, indisponible sans
// flag). On installe un shim mémoire simple pour les composants qui l'utilisent.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>()
  const mem: Storage = {
    get length() { return store.size },
    clear() { store.clear() },
    getItem(k: string) { return store.has(k) ? store.get(k)! : null },
    key(i: number) { return Array.from(store.keys())[i] ?? null },
    removeItem(k: string) { store.delete(k) },
    setItem(k: string, v: string) { store.set(k, String(v)) },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: mem, configurable: true })
}
