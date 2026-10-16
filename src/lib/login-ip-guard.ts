// ─── Limite de connexion par adresse IP (anti pulvérisation de mots de passe) ──
// Ne compte que les ÉCHECS (compte inconnu, mauvais mot de passe, code MFA invalide) : les
// connexions réussies d'une entreprise derrière une même IP de sortie (NAT) ne la bloquent plus.
// Seuil réglable par l'exploitant : LOGIN_IP_MAX_FAILURES (défaut 50 échecs / 15 min).
import { rateLimit, rateLimitPeek } from '@/lib/rate-limit'

export const LOGIN_IP_WINDOW_MS = 15 * 60 * 1000
const DEFAUT = 50
const cle = (ip: string) => `login:ip:${ip}`

/** Nombre d'échecs tolérés par IP sur la fenêtre (variable d'environnement, sinon 50). */
export function loginIpMaxFailures(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.LOGIN_IP_MAX_FAILURES)
  return Number.isInteger(n) && n > 0 ? n : DEFAUT
}

/** L'IP a-t-elle déjà épuisé ses échecs ? (lecture seule ; IP inconnue → jamais bloquée) */
export async function loginIpBloquee(ip: string, max = loginIpMaxFailures()): Promise<boolean> {
  if (!ip || ip === 'unknown') return false
  return !(await rateLimitPeek(cle(ip), max)).allowed
}

/** Compte un échec de connexion pour l'IP. */
export async function enregistrerEchecConnexionIp(ip: string, max = loginIpMaxFailures()): Promise<void> {
  if (!ip || ip === 'unknown') return
  await rateLimit(cle(ip), max, LOGIN_IP_WINDOW_MS)
}
