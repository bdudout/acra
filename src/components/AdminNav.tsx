'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslation } from '@/lib/i18n/context'
import { Home, Users, Shield, ClipboardList, Mail, Trash2, Building2, FlaskConical } from 'lucide-react'

type AdminTab = 'dashboard' | 'users' | 'security' | 'smtp' | 'audit' | 'recovery' | 'organizations' | 'demo'

/**
 * Navigation interne de l'espace d'administration (composant partagé).
 * Icônes SVG (lucide) pour une cohérence cross-OS — audit UX #2.
 */
export default function AdminNav({ active }: { active: AdminTab }) {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const isSuperAdmin = (session?.user as any)?.role === 'SUPER_ADMIN'
  // Onglet « Démo » : uniquement sur une instance de démo (statut renvoyé par l'API).
  const [isDemo, setIsDemo] = useState(false)
  useEffect(() => {
    fetch('/api/demo/status').then(r => r.ok ? r.json() : null).then(s => setIsDemo(!!s?.demo)).catch(() => {})
  }, [])

  const items = [
    { key: 'dashboard', href: '/admin',          Icon: Home,          label: t.admin.navDashboard },
    { key: 'users',     href: '/admin/users',    Icon: Users,         label: t.admin.navUsers },
    // Gestion des organisations — réservée au super-administrateur (multi-organisation).
    ...(isSuperAdmin ? [{ key: 'organizations', href: '/admin/organizations', Icon: Building2, label: t.admin.navOrganizations }] : []),
    { key: 'security',  href: '/admin/security', Icon: Shield,        label: t.admin.navSecurity },
    { key: 'smtp',      href: '/admin/smtp',     Icon: Mail,          label: t.admin.navSmtp },
    { key: 'audit',     href: '/admin/audit',    Icon: ClipboardList, label: t.admin.navAudit },
    { key: 'recovery',  href: '/admin/recovery', Icon: Trash2,        label: t.admin.navRecovery },
    // Réglages du site de démonstration — super-administrateur + instance de démo.
    ...(isSuperAdmin && isDemo ? [{ key: 'demo', href: '/admin/demo', Icon: FlaskConical, label: t.admin.navDemo }] : []),
  ] as const

  return (
    <nav className="flex flex-wrap gap-2 mb-6" aria-label="Navigation administration">
      {items.map(({ key, href, Icon, label }) => {
        const isActive = key === active
        return (
          <Link
            key={key}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={`px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 ${
              isActive ? 'bg-ebios-100 text-ebios-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Icon size={15} aria-hidden="true" /> {label}
          </Link>
        )
      })}
    </nav>
  )
}
