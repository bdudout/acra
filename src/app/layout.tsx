import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import Footer from '@/components/Footer'
import CookieBanner from '@/components/CookieBanner'
import DemoBanner from '@/components/DemoBanner'
import { isDemoInstance } from '@/lib/demo-server'
import { THEME_SCRIPT } from '@/lib/theme-script'
import { headers } from 'next/headers'
import { getServerT } from '@/lib/i18n'
import { getBranding } from '@/lib/branding.server'
import { BrandingProvider } from '@/components/BrandingProvider'

const inter = Inter({ subsets: ['latin'] })

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://acra-ebios.app'

// Couleur de la barre du navigateur (mobile) + color-scheme natif, assortis au thème
export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9fafb' },
    { media: '(prefers-color-scheme: dark)',  color: '#030712' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'ACRA — Augmented Cyber Risk Analysis',
    template: '%s | ACRA',
  },
  description:
    "Réalisez vos analyses de risques cybersécurité selon la méthode EBIOS RM (ANSSI) de façon guidée. 5 ateliers structurés, gestion des accès RBAC, export PDF, compatible ISO 27005.",
  keywords: [
    'EBIOS RM', 'ANSSI', 'analyse de risques', 'cybersécurité', 'ISO 27005',
    'risk management', 'RSSI', 'scénarios de risque', 'ACRA',
  ],
  authors: [{ name: 'ACRA Contributors' }],
  creator: 'ACRA',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: BASE_URL,
    siteName: 'ACRA — Augmented Cyber Risk Analysis',
    title: 'ACRA — Analyse de risques EBIOS RM guidée',
    description:
      "Réalisez vos analyses de risques cybersécurité selon EBIOS RM (ANSSI). 5 ateliers structurés, RBAC, export PDF, ISO 27005.",
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ACRA — Augmented Cyber Risk Analysis',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ACRA — Analyse de risques EBIOS RM guidée',
    description:
      "5 ateliers EBIOS RM, RBAC, export PDF, ISO 27005. Open-source.",
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1 },
  },
  // Favicons servis par la convention App Router (src/app/icon.png + apple-icon.png).
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce CSP (issue #108) posé par le middleware en production — appliqué au
  // script de thème inline pour qu'il soit autorisé sans `'unsafe-inline'`.
  const nonce = (await headers()).get('x-nonce') ?? undefined
  // Bandeau démo : uniquement sur une instance de démo PROUVÉE (env + marqueur figé).
  const demo = await isDemoInstance()
  // Identité de l'app (nom configurable, repli sur les libellés i18n).
  const t = await getServerT()
  const branding = await getBranding({ nom: t.auth.appName, baseline: t.auth.appSubtitle })
  return (
    // lang="fr" par défaut — mis à jour dynamiquement côté client via LanguageSwitcher
    <html lang="fr">
      <head>
        {/* Script anti-FOUC : applique le thème AVANT que React n'hydrate */}
        {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${inter.className} flex flex-col min-h-screen`}>
        {/* Lien d'évitement — RGAA 12.6 : permet aux utilisateurs clavier de
            sauter la navigation et d'aller directement au contenu principal */}
        <a href="#main-content" className="skip-link">
          Aller au contenu principal
        </a>
        <Providers>
          <BrandingProvider value={branding}>
            <div className="flex flex-col min-h-screen">
              {demo && <DemoBanner />}
              {children}
              <Footer />
              <CookieBanner />
            </div>
          </BrandingProvider>
        </Providers>
      </body>
    </html>
  )
}
