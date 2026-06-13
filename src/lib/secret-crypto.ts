/**
 * secret-crypto.ts — Chiffrement au repos des secrets applicatifs (F005 / CWE-312).
 *
 * Chiffre les secrets sensibles (Client Secret OIDC, clés/secret SMS) AVANT
 * persistance en base, et les déchiffre à la lecture. Algorithme : AES-256-GCM
 * (confidentialité + intégrité authentifiée via le tag GCM).
 *
 * Format stocké : `enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`
 *
 * Clé : dérivée par scrypt depuis `SECRETS_ENCRYPTION_KEY` (recommandé, dédiée)
 * ou, à défaut, `NEXTAUTH_SECRET`. La clé est lue paresseusement (à l'appel) pour
 * rester testable et ne pas bloquer le démarrage si la fonctionnalité n'est pas utilisée.
 *
 * Rétro-compatibilité : une valeur SANS préfixe `enc:v1:` est considérée comme un
 * secret en clair hérité (legacy) et renvoyée telle quelle par decryptSecret ; elle
 * sera chiffrée au prochain enregistrement. Aucune migration de schéma n'est requise.
 *
 * ⚠️ Si la clé change, les ciphertext existants deviennent indéchiffrables :
 *    decryptSecret renvoie alors `null` (l'admin devra ressaisir le secret).
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const PREFIX = 'enc:v1:'
const SALT = 'acra-secret-crypto-v1' // sel applicatif fixe pour une dérivation stable

function getKey(): Buffer {
  const material = process.env.SECRETS_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET
  if (!material) {
    throw new Error(
      'secret-crypto: SECRETS_ENCRYPTION_KEY (ou NEXTAUTH_SECRET) requis pour chiffrer les secrets'
    )
  }
  return scryptSync(material, SALT, 32)
}

/**
 * Chiffre un secret. Préserve null/undefined/'' ; idempotent sur une valeur déjà chiffrée.
 */
export function encryptSecret<T extends string | null | undefined>(plaintext: T): T {
  if (plaintext == null || plaintext === '') return plaintext
  if (plaintext.startsWith(PREFIX)) return plaintext // déjà chiffré

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return (PREFIX +
    [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':')) as T
}

/**
 * Déchiffre un secret. Renvoie une valeur en clair héritée telle quelle (legacy),
 * et `null` si le déchiffrement échoue (clé changée ou donnée altérée).
 */
export function decryptSecret(value: string | null | undefined): string | null | undefined {
  if (value == null || value === '') return value
  if (!value.startsWith(PREFIX)) return value // legacy plaintext — lecture transparente

  try {
    const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(':')
    const iv = Buffer.from(ivB64, 'base64')
    const tag = Buffer.from(tagB64, 'base64')
    const ct = Buffer.from(ctB64, 'base64')
    const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
  } catch {
    console.warn('[secret-crypto] déchiffrement impossible (clé modifiée ou donnée altérée)')
    return null
  }
}
