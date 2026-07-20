import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { isAdminRole, type UserRole } from '@/lib/permissions'

/**
 * Garde d'accès de l'espace d'administration (`/admin/*`) : ADMIN ou SUPER_ADMIN.
 * L'ADMIN accède aux sections scopées à SON organisation (comptes, corbeille) ;
 * les sections d'INSTANCE (sécurité/SMTP/SSO, organisations, audit, démo) se gardent
 * en plus elles-mêmes (SUPER_ADMIN). Enforcement serveur (pas de flash, non
 * contournable côté client) ; les routes `/api/admin/*` gardent leur propre contrôle.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as { role?: UserRole } | undefined)?.role
  if (!role || !isAdminRole(role)) redirect('/dashboard')
  return <>{children}</>
}
