'use client'

import { signOut, useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import { ROLE_LABELS, ROLE_COLORS, type UserRole } from '@/lib/permissions'
import { useTranslation } from '@/lib/i18n/context'
import GlobalSearch from './GlobalSearch'
import {
  LayoutDashboard, FolderKanban, AlertTriangle, Shield,
  User, ChevronDown, Settings, KeyRound, LogOut,
} from 'lucide-react'

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef    = useRef<HTMLDivElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)

  const userRole: UserRole = (session?.user as any)?.role ?? 'ANALYSTE'
  const isAdmin      = userRole === 'ADMIN'
  const isLecteur    = userRole === 'LECTEUR'

  // Fermer le menu sur clic extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fermer le menu sur Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false)
        menuBtnRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  function navClass(active: boolean) {
    return `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      active ? 'bg-ebios-100 text-ebios-700' : 'text-gray-600 hover:bg-gray-100'
    }`
  }

  return (
    <nav
      className="bg-white border-b border-gray-200 sticky top-0 z-40"
      aria-label="Navigation principale"
    >
      <div className="max-w-6xl mx-auto px-4 flex items-center h-14 gap-4">

        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 mr-4 flex-shrink-0"
          aria-label="ACRA — Retour au tableau de bord"
        >
          <Image src="/logo-head.png" alt="" width={365} height={384} priority className="h-10 w-auto" />
          <span className="hidden sm:inline leading-none">
            <span className="block font-bold text-ebios-700 dark:text-ebios-300">ACRA</span>
            <span className="block text-[10px] font-normal text-gray-400 tracking-wide">augmented cyber risk analysis</span>
          </span>
        </Link>

        {/* Liens de navigation */}
        <div className="flex items-center gap-1 flex-1" role="list">
          <Link
            href="/dashboard"
            className={`${navClass(pathname === '/dashboard')} inline-flex items-center gap-1.5`}
            aria-current={pathname === '/dashboard' ? 'page' : undefined}
          >
            <LayoutDashboard size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{t.nav.dashboard}</span>
          </Link>

          <Link
            href="/analyses"
            className={`${navClass(pathname.startsWith('/analyses'))} inline-flex items-center gap-1.5`}
            aria-current={pathname.startsWith('/analyses') ? 'page' : undefined}
          >
            <FolderKanban size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{isLecteur ? t.nav.analysesReader : t.nav.analyses}</span>
          </Link>

          <Link
            href="/risques"
            className={`${navClass(pathname === '/risques')} inline-flex items-center gap-1.5`}
            aria-current={pathname === '/risques' ? 'page' : undefined}
          >
            <AlertTriangle size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{t.nav.risks}</span>
          </Link>

          <Link
            href="/actions"
            className={`${navClass(pathname === '/actions')} inline-flex items-center gap-1.5`}
            aria-current={pathname === '/actions' ? 'page' : undefined}
          >
            <Shield size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{t.nav.actions}</span>
          </Link>
        </div>

        {/* Recherche globale */}
        <GlobalSearch />

        {/* Zone droite */}
        <div className="flex items-center gap-2">
          {/* Menu utilisateur (le badge de rôle est dans l'en-tête du menu) */}
          <div className="relative" ref={menuRef}>
            <button
              ref={menuBtnRef}
              onClick={() => setMenuOpen(v => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label={`Menu utilisateur — ${session?.user?.name || session?.user?.email || 'Compte'}`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100
                         rounded-lg transition-colors"
            >
              <User size={16} aria-hidden="true" />
              <span className="hidden sm:inline font-medium text-sm">
                {session?.user?.name?.split(' ')[0] || session?.user?.email?.split('@')[0] || 'Compte'}
              </span>
              <ChevronDown size={14} className="text-gray-400" aria-hidden="true" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                aria-label="Menu utilisateur"
                className="absolute right-0 top-full mt-1 bg-white border border-gray-200
                           rounded-xl shadow-lg p-1 z-50 w-52 min-w-max"
              >
                {/* Nom + email compact en haut */}
                <div className="px-3 py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-800">{session?.user?.name || 'Compte'}</div>
                  <div className="text-xs text-gray-500 truncate">{session?.user?.email}</div>
                  <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[userRole]}`}>
                    {t.roles[userRole] ?? ROLE_LABELS[userRole]}
                  </span>
                </div>

                <Link
                  href="/profile"
                  role="menuitem"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700
                             hover:bg-gray-50 rounded-lg"
                  onClick={() => setMenuOpen(false)}
                >
                  <User size={16} aria-hidden="true" />
                  {t.nav.profile}
                </Link>

                {!isLecteur && (
                  <Link
                    href="/configuration"
                    role="menuitem"
                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${
                      pathname === '/configuration'
                        ? 'bg-ebios-50 text-ebios-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings size={16} aria-hidden="true" />
                    {t.nav.configuration}
                  </Link>
                )}

                {isAdmin && (
                  <>
                    <Link
                      href="/admin"
                      role="menuitem"
                      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${
                        pathname.startsWith('/admin')
                          ? 'bg-ebios-50 text-ebios-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => setMenuOpen(false)}
                    >
                      <KeyRound size={16} aria-hidden="true" />
                      {t.nav.admin}
                    </Link>
                  </>
                )}

                <hr className="my-1 border-gray-100" aria-hidden="true" />

                <button
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); signOut({ callbackUrl: '/' }) }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm
                             text-gray-700 hover:bg-gray-50 rounded-lg"
                >
                  <LogOut size={16} aria-hidden="true" />
                  {t.nav.logout}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
