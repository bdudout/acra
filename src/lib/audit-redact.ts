/**
 * audit-redact.ts — Masquage des secrets avant journalisation (CWE-312 / CWE-532).
 *
 * Les payloads d'audit (auditLog) ne doivent jamais contenir de secret en clair
 * (clés API, secrets OIDC/SMS…). Cette primitive remplace par "[REDACTED]" les
 * clés sensibles **renseignées**, tout en préservant null/undefined (pour ne pas
 * laisser croire qu'un secret existe là où il n'y en a pas).
 *
 * Usage :
 *   details: redactSecrets(parsed.data, ['smsApiKey', 'smsApiSecret'])
 */
const REDACTED = '[REDACTED]'

/** Masque les champs sensibles d'un objet (secrets, tokens) avant journalisation d'audit ; renvoie une copie. */
export function redactSecrets<T extends Record<string, unknown>>(
  obj: T,
  keys: readonly (keyof T)[]
): T {
  const copy = { ...obj }
  for (const key of keys) {
    if (copy[key] !== null && copy[key] !== undefined) {
      copy[key] = REDACTED as T[keyof T]
    }
  }
  return copy
}
