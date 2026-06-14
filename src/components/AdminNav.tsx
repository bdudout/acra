'use client'

import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'
import { Home, Users, Shield, ClipboardList, Mail } from 'lucide-react'

type AdminTab = 'dashboard' | 'users' | 'security' | 'smtp' | 'audit'

/**
 * Navigation interne de l'espace d'administration (composant partagé).
 * Icônes SVG (lucide) pour une cohérence cross-OS — audit UX #2.
 */
export default function AdminNav({ active }: { active: AdminTab }) {
  const { t } = useTranslation()

  const items = [
    { key: 'dashboard', href: '/admin',          Icon: Home,          label: t.admin.navDashboard },
    { key: 'users',     href: '/admin/users',    Icon: Users,         label: t.admin.navUsers },
    { key: 'security',  href: '/admin/security', Icon: Shield,        label: t.admin.navSecurity },
    { key: 'smtp',      href: '/admin/smtp',     Icon: Mail,          label: t.admin.navSmtp },
    { key: 'audit',     href: '/admin/audit',    Icon: ClipboardList, label: t.admin.navAudit },
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
