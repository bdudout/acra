'use client'

import { signOut, useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import { ROLE_LABELS, ROLE_COLORS, isAdminRole, type UserRole } from '@/lib/permissions'
import { buildNav, type NavKey, type NavModules } from '@/lib/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { useBranding } from '@/components/BrandingProvider'
import GlobalSearch from './GlobalSearch'
import OrgSwitcher from './OrgSwitcher'
import {
  LayoutDashboard, FolderKanban, AlertTriangle, Shield, Network, ShieldCheck,
  User, ChevronDown, Settings, KeyRound, LogOut, FileWarning, Workflow, BookMarked,
  Map, BarChart3, Siren, ClipboardCheck, ClipboardList, Search, TrendingUp, Landmark,
  LayoutGrid, type LucideIcon,
} from 'lucide-react'

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { t } = useTranslation()
  const branding = useBranding()
  const [menuOpen, setMenuOpen] = useState(false)
  const [grcOpen, setGrcOpen]   = useState(false)
  // Position du menu « GRC » en coordonnées viewport : il est rendu en `fixed`
  // pour ÉCHAPPER au clipping de la barre (overflow-x-auto force overflow-y:auto,
  // ce qui masquait le menu déroulé). Recalculée à chaque ouverture.
  const [grcPos, setGrcPos]     = useState<{ top: number; left: number } | null>(null)
  const menuRef    = useRef<HTMLDivElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const grcRef     = useRef<HTMLDivElement>(null)
  const grcBtnRef  = useRef<HTMLButtonElement>(null)

  const userRole: UserRole = (session?.user as any)?.role ?? 'ANALYSTE'
  const isAdmin        = isAdminRole(userRole)
  const isSuperAdmin   = userRole === 'SUPER_ADMIN'
  const isLecteur      = userRole === 'LECTEUR'

  // File d'attente du valideur : dérogations en attente de l'action de l'utilisateur
  // (avis RSSI, double regard, validation métier) → badge sur le menu « GRC ».
  const [derogPending, setDerogPending] = useState(0)
  const isDerogActor = userRole === 'RSSI' || userRole === 'DIRECTION_METIER' || isAdmin
  useEffect(() => {
    if (!isDerogActor || !session?.user) return
    fetch('/api/derogations')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && typeof d.pending === 'number') setDerogPending(d.pending) })
      .catch(() => {})
  }, [isDerogActor, session?.user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Modules GRC actifs (état effectif) → alimentent le modèle de navigation.
  const [modules, setModules] = useState<NavModules>({
    registre: false, incidents: false, controles: false, audit: false, kri: false, reglementaire: false,
  })
  useEffect(() => {
    if (!session?.user) return
    fetch('/api/modules').then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setModules({
        registre:      Boolean(d.registreRisquesActive),
        incidents:     Boolean(d.incidentsActive),
        controles:     Boolean(d.controlePermanentActive),
        audit:         Boolean(d.auditInterneActive),
        kri:           Boolean(d.kriActive),
        reglementaire: Boolean(d.reglementaireActive),
      }) })
      .catch(() => {})
  }, [session?.user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Modèle de navigation : parcours EBIOS inline + modules GRC repliés (logique pure).
  const { primary, grc } = buildNav(userRole, modules)

  // Fermer les menus sur clic extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false)
      if (grcRef.current && !grcRef.current.contains(target)) setGrcOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fermer les menus sur Escape (et rendre le focus au déclencheur)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (menuOpen) { setMenuOpen(false); menuBtnRef.current?.focus() }
      if (grcOpen)  { setGrcOpen(false);  grcBtnRef.current?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen, grcOpen])

  // Le menu « GRC » est positionné en `fixed` d'après le bouton : on le referme
  // au scroll/resize pour éviter tout décalage (plutôt que de le suivre).
  useEffect(() => {
    if (!grcOpen) return
    const close = () => setGrcOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close) }
  }, [grcOpen])

  // Ouvre/ferme le menu « GRC » en recalculant sa position viewport à l'ouverture.
  function toggleGrc() {
    if (!grcOpen && grcBtnRef.current) {
      const r = grcBtnRef.current.getBoundingClientRect()
      setGrcPos({ top: Math.round(r.bottom + 4), left: Math.round(r.left) })
    }
    setGrcOpen(v => !v)
  }

  function navClass(active: boolean) {
    return `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      active ? 'bg-ebios-100 text-ebios-700' : 'text-gray-600 hover:bg-gray-100'
    }`
  }

  // Une route est active si elle est exacte ou parente de la route courante.
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // Métadonnées d'affichage (icône + libellé i18n) de chaque lien. Défini DANS le
  // composant car les libellés sont traduits (règle i18n du projet).
  const NAV_META: Record<NavKey, { href: string; Icon: LucideIcon; label: string }> = {
    dashboard:     { href: '/dashboard',     Icon: LayoutDashboard, label: t.nav.dashboard },
    analyses:      { href: '/analyses',      Icon: FolderKanban,    label: isLecteur ? t.nav.analysesReader : t.nav.analyses },
    risques:       { href: '/risques',       Icon: AlertTriangle,   label: t.nav.risks },
    tiers:         { href: '/tiers',         Icon: Network,         label: t.nav.tiers },
    actions:       { href: '/actions',       Icon: Shield,          label: t.nav.actions },
    conformite:    { href: '/conformite',    Icon: ShieldCheck,     label: t.nav.conformite },
    derogations:   { href: '/derogations',   Icon: FileWarning,     label: t.nav.derogations },
    registre:      { href: '/registre',      Icon: BookMarked,      label: t.nav.registre },
    campagnes:     { href: '/campagnes',     Icon: ClipboardList,   label: t.nav.campagnes },
    cartographie:  { href: '/cartographie',  Icon: Map,             label: t.nav.cartographie },
    pilotage:      { href: '/pilotage',      Icon: BarChart3,       label: t.nav.pilotage },
    processus:     { href: '/processus',     Icon: Workflow,        label: t.nav.processus },
    incidents:     { href: '/incidents',     Icon: Siren,           label: t.nav.incidents },
    controles:     { href: '/controles',     Icon: ClipboardCheck,  label: t.nav.controles },
    audit:         { href: '/audit',         Icon: Search,          label: t.nav.audit },
    kri:           { href: '/kri',           Icon: TrendingUp,      label: t.nav.kri },
    reglementaire: { href: '/reglementaire', Icon: Landmark,        label: t.nav.reglementaire },
  }

  const grcActive = grc.some(key => isActive(NAV_META[key].href))

  const badge = (n: number, label: string) => (
    <span
      className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold"
      aria-label={label}
    >{n}</span>
  )

  return (
    <nav
      className="bg-white border-b border-gray-200 sticky top-0 z-40"
      aria-label="Navigation principale"
    >
      {/* Rangée du haut : logo + recherche, sélecteur d'organisation et menu utilisateur */}
      <div className="max-w-6xl mx-auto px-4 flex items-center h-14 gap-4">

        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 mr-4 flex-shrink-0"
          aria-label={branding.nom}
        >
          <Image src="/logo-head.png" alt="" width={365} height={384} priority className="h-10 w-auto" />
          <span className="hidden sm:inline leading-none">
            <span className="block font-bold text-ebios-700 dark:text-ebios-300">{branding.nom}</span>
            <span className="block text-[10px] font-normal text-gray-400 tracking-wide lowercase">{branding.baseline}</span>
          </span>
        </Link>

        {/* Pousse la zone droite au bout de la rangée */}
        <div className="flex-1" />

        {/* Recherche globale */}
        <GlobalSearch />

        {/* Zone droite */}
        <div className="flex items-center gap-2">
          {/* Sélecteur d'organisation (masqué si une seule organisation accessible) */}
          <OrgSwitcher />
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

                {/* L'espace /admin (instance) est réservé au super-admin ; un ADMIN
                    ne gère que /configuration (méthodologie). */}
                {isSuperAdmin && (
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

      {/* Rangée du bas : parcours EBIOS inline + menu déroulant « GRC » pour le reste */}
      <div className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-1 h-11 overflow-x-auto">

          {primary.map(key => {
            const item = NAV_META[key]
            const active = isActive(item.href)
            return (
              <Link
                key={key}
                href={item.href}
                className={`${navClass(active)} inline-flex items-center gap-1.5 flex-shrink-0`}
                aria-current={active ? 'page' : undefined}
              >
                <item.Icon size={16} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            )
          })}

          {/* Menu déroulant « GRC » : gouvernance + modules, filtrés par droits.
              Masqué si l'utilisateur n'a accès à aucun de ces liens. */}
          {grc.length > 0 && (
            <div className="relative flex-shrink-0" ref={grcRef}>
              <button
                ref={grcBtnRef}
                onClick={toggleGrc}
                aria-expanded={grcOpen}
                aria-haspopup="menu"
                className={`${navClass(grcActive)} inline-flex items-center gap-1.5`}
              >
                <LayoutGrid size={16} aria-hidden="true" />
                <span>{t.nav.grc}</span>
                {derogPending > 0 && badge(derogPending, `${derogPending} en attente`)}
                <ChevronDown size={14} className="text-gray-400" aria-hidden="true" />
              </button>

              {grcOpen && (
                <div
                  role="menu"
                  aria-label={t.nav.grc}
                  style={{ top: grcPos?.top, left: grcPos?.left }}
                  className="fixed bg-white border border-gray-200
                             rounded-xl shadow-lg p-1 z-50 w-56 max-h-96 overflow-y-auto"
                >
                  {grc.map(key => {
                    const item = NAV_META[key]
                    const active = isActive(item.href)
                    return (
                      <Link
                        key={key}
                        href={item.href}
                        role="menuitem"
                        onClick={() => setGrcOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${
                          active ? 'bg-ebios-50 text-ebios-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                        aria-current={active ? 'page' : undefined}
                      >
                        <item.Icon size={16} aria-hidden="true" />
                        <span className="flex-1">{item.label}</span>
                        {key === 'derogations' && derogPending > 0 && badge(derogPending, `${derogPending} en attente`)}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
