// ─── Lecture de la politique de mot de passe d'instance (point unique) ───────
// Backlog T19 : la lecture `passwordPolicy.findUnique({ id: 'global' })` et son
// remappage étaient recopiés dans une quinzaine de routes. Nouvelles routes : ici.
import { prisma } from '@/lib/prisma'
import { DEFAULT_POLICY, type PasswordPolicyShape } from '@/lib/password-policy'

/** Politique de mot de passe configurée (défaut sûr si absente ou illisible). */
export async function loadPasswordPolicy(): Promise<PasswordPolicyShape> {
  try {
    const p = await prisma.passwordPolicy.findUnique({ where: { id: 'global' } })
    if (!p) return DEFAULT_POLICY
    return {
      minLength: p.minLength, requireUppercase: p.requireUppercase, requireLowercase: p.requireLowercase,
      requireNumbers: p.requireNumbers, requireSpecial: p.requireSpecial, maxAgeDays: p.maxAgeDays,
    }
  } catch {
    return DEFAULT_POLICY
  }
}
