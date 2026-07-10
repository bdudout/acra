import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'

/**
 * Garde d'accès de TOUT l'espace d'administration (`/admin/*`) : réservé au
 * SUPER_ADMIN. Un ADMIN d'organisation n'administre pas l'instance — il ne modifie
 * que la méthodologie (échelles/matrice) via `/configuration`. Enforcement serveur
 * (pas de flash, non contournable côté client). Les routes `/api/admin/*` gardent
 * en plus leur propre contrôle de rôle.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as { role?: string } | undefined)?.role
  if (role !== 'SUPER_ADMIN') redirect('/dashboard')
  return <>{children}</>
}
