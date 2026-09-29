/**
 * rapport-diffusion.ts — Diffusion d'une édition validée (lot L2, suite). Module PUR.
 * Une entrée est soit un nom (comité, direction : traçabilité seule), soit une adresse e-mail.
 * Seuls les MEMBRES de l'organisation reçoivent un e-mail (lien vers l'édition, jamais le contenu) ;
 * une adresse extérieure est consignée « hors organisation » (à transmettre par l'export masqué).
 */

export interface MembreDiffusion { email: string; locale: string | null }
export type StatutDestinataire = 'A_ENVOYER' | 'HORS_ORGANISATION' | 'NOM'
export interface DestinataireClasse { nom: string; email?: string; locale?: string | null; statut: StatutDestinataire }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX = 20

export function classerDestinataires(entrees: string[], membres: MembreDiffusion[]): DestinataireClasse[] {
  const parEmail = new Map(membres.map(m => [m.email.toLowerCase(), m]))
  const vus = new Set<string>()
  const out: DestinataireClasse[] = []
  for (const brut of entrees) {
    const nom = brut.trim().slice(0, 120)
    if (!nom || vus.has(nom.toLowerCase())) continue
    vus.add(nom.toLowerCase())
    if (out.length >= MAX) break
    if (!EMAIL_RE.test(nom)) { out.push({ nom, statut: 'NOM' }); continue }
    const m = parEmail.get(nom.toLowerCase())
    out.push(m ? { nom, email: m.email, locale: m.locale, statut: 'A_ENVOYER' } : { nom, statut: 'HORS_ORGANISATION' })
  }
  return out
}
