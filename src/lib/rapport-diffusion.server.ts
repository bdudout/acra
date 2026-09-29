// ─── Diffusion e-mail d'une édition validée (lot L2, suite) ──────────────────
// Envoie un e-mail (lien, pas de contenu) aux membres actifs de l'organisation désignés
// par adresse ; consigne le résultat par destinataire. SMTP absent → « non envoyé », sans erreur.

import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { rapportDiffusionEmail } from '@/lib/email-i18n'
import { getT } from '@/lib/i18n'
import { classerDestinataires, type StatutDestinataire } from '@/lib/rapport-diffusion'

export interface DestinataireDiffuse { nom: string; statut: StatutDestinataire; envoye?: boolean }

export async function diffuserRapport(
  orgId: string, entrees: string[], ed: { id: string; code: string; periode: string; langue: string },
): Promise<{ destinataires: DestinataireDiffuse[]; envoyes: number }> {
  const rows = await prisma.orgMembership.findMany({
    where: { organizationId: orgId }, select: { user: { select: { email: true, isActive: true, locale: true } } }, take: 5000,
  })
  const membres = rows.filter(r => r.user.isActive && r.user.email).map(r => ({ email: r.user.email as string, locale: r.user.locale }))
  const classes = classerDestinataires(entrees, membres)
  const base = (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '')
  const cat = { ...getT(ed.langue).rapports.catalogue, ...getT(ed.langue).rapports.catalogueCtl, ...getT(ed.langue).rapports.catalogueAud } as Record<string, { titre: string }>
  const titre = cat[ed.code]?.titre ?? ed.code
  let envoyes = 0
  const destinataires: DestinataireDiffuse[] = []
  for (const c of classes) {
    if (c.statut !== 'A_ENVOYER' || !c.email) { destinataires.push({ nom: c.nom, statut: c.statut }); continue }
    const { subject, text, html } = rapportDiffusionEmail(c.locale, { titre, periode: ed.periode, lien: `${base}/rapports/${ed.id}` })
    const res = await sendEmail({ to: c.email, subject, text, html })
    if (res.ok) envoyes++
    destinataires.push({ nom: c.nom, statut: c.statut, envoye: res.ok })
  }
  return { destinataires, envoyes }
}
