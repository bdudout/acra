/** Validate release metadata before passing any value to Docker or a remote shell. */
export function validateManifest(data, expectedVersion) {
  if (!data || data.version !== expectedVersion || !/^v\d+\.\d+\.\d+$/.test(data.version)) throw new Error('Stable version required')
  if (!/^[a-f0-9]{40}$/.test(data.revision)) throw new Error('Invalid revision')
  if (!/^ghcr\.io\/bdudout\/acra@sha256:[a-f0-9]{64}$/.test(data.image)) throw new Error('Invalid immutable image')
  if (!/^[a-f0-9]{64}$/.test(data.migrationsHash)) throw new Error('Invalid migration fingerprint')
  return data
}
