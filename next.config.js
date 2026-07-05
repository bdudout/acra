/** @type {import('next').NextConfig} */
const IS_PROD = process.env.NODE_ENV === 'production'

const nextConfig = {
  output: 'standalone',
  // @react-pdf/renderer reste externe (non bundlé/transpilé par SWC, qui produit
  // un arbre rejeté → « React error #31 »). Le rendu PDF passe par un module CJS
  // pré-compilé avec esbuild (.pdf-runtime/, voir scripts/compile-pdf-template.mjs)
  // chargé au runtime. L'entrée ici garantit que react-pdf est tracé dans le
  // standalone (présent dans node_modules au runtime).
  serverExternalPackages: ['@prisma/client', 'bcryptjs', '@react-pdf/renderer', 'nodemailer'],
  experimental: {
    instrumentationHook: true,
  },

  // ── Limite de taille des corps de requête ────────────────────────────────
  // Protège contre les DoS par payload surdimensionné (import JSON, workshop)
  // La limite Next.js par défaut est 4MB ; on la réduit à 2MB.
  // Note : peut être surchargée par route via export const config = { api: { bodyParser: { sizeLimit: '...' } } }
  // Next.js App Router ne supporte pas encore bodyParser global ici, mais ce
  // commentaire documente la limite attendue côté reverse-proxy (Nginx/Traefik).

  headers: async () => [
    // ── Headers de sécurité globaux ───────────────────────────────────────
    {
      source: '/(.*)',
      headers: [
        // Clickjacking
        { key: 'X-Frame-Options', value: 'DENY' },
        // MIME sniffing
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        // Referrer
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        // Permissions (caméra, micro, géoloc, paiement désactivés)
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
        },
        // Flash / PDF cross-domain
        { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        // DNS prefetch — évite les fuites de navigation
        { key: 'X-DNS-Prefetch-Control', value: 'off' },

        // HSTS — activer uniquement en production HTTPS
        ...(IS_PROD ? [{
          key: 'Strict-Transport-Security',
          // max-age 1 an + subdomains + preload (HSTS preload list)
          value: 'max-age=31536000; includeSubDomains; preload',
        }] : []),

        // ── Content Security Policy ────────────────────────────────────────
        // La CSP est désormais posée par le MIDDLEWARE (src/middleware.ts) pour
        // permettre un `script-src` à nonce + strict-dynamic en production (issue
        // #108). Ne pas la redéfinir ici : deux en-têtes CSP ⇒ intersection stricte
        // qui casserait le rendu.
      ],
    },

    // ── Headers spécifiques aux API routes ───────────────────────────────
    // Interdit explicitement le cache sur les routes API sensibles
    {
      source: '/api/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
        { key: 'Pragma', value: 'no-cache' },
        { key: 'Expires', value: '0' },
      ],
    },
  ],
}

module.exports = nextConfig
