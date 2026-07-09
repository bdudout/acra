'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTranslation } from '@/lib/i18n/context'
import LanguageSwitcher from '@/components/LanguageSwitcher'

const GITHUB_URL = 'https://github.com/bdudout/acra'
const GUIDE_URL = `${GITHUB_URL}/blob/main/docs/deploiement-demo.md`

/**
 * Page publique « Déployer ACRA dans mon SI » — cible du bouton du bandeau démo.
 * Explique l'architecture, les serveurs recommandés et les étapes de déploiement,
 * et renvoie vers le dépôt GitHub (code + guide détaillé). Compatible thème clair/sombre.
 */
export default function DeployerPage() {
  const { t } = useTranslation()
  const p = t.deployPage

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 text-slate-800 dark:text-gray-200">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-mark.png" alt="" width={334} height={384} className="h-8 w-auto" />
            <span className="font-bold text-slate-900 dark:text-white">ACRA</span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link href="/" className="text-sm text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-100">{p.back}</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">{p.title}</h1>
        <p className="text-slate-600 dark:text-gray-400 mb-10 max-w-2xl">{p.subtitle}</p>

        {/* Architecture */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{p.archTitle}</h2>
          <p className="text-slate-600 dark:text-gray-400 mb-4">{p.archIntro}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { k: 'Application', v: 'Next.js 16 (build standalone, node server.js)' },
              { k: 'Base de données', v: 'PostgreSQL 16' },
              { k: 'Reverse-proxy / HTTPS', v: 'Caddy (certificats Let’s Encrypt automatiques) — ou Nginx / Traefik' },
              { k: 'Orchestration', v: 'Docker Compose (services : db, migrator, app, backup)' },
              { k: 'Authentification', v: 'NextAuth (sessions JWT), RBAC 6 rôles' },
              { k: 'Dépendances externes', v: 'Aucune — 100 % auto-hébergeable' },
            ].map(({ k, v }) => (
              <div key={k} className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-ebios-600 dark:text-ebios-300 mb-1">{k}</div>
                <div className="text-sm text-slate-700 dark:text-gray-300">{v}</div>
              </div>
            ))}
          </div>
          {/* Schéma de flux */}
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 overflow-x-auto">
            <pre className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed">{
`Internet ──HTTPS──▶  Caddy (reverse-proxy, TLS)
                         │
                         ▼
                    App (Next.js)  ──▶  PostgreSQL
                         ▲                  ▲
                     migrator            backup (pg_dump)`}</pre>
          </div>
        </section>

        {/* Serveurs recommandés */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{p.serversTitle}</h2>
          <p className="text-slate-600 dark:text-gray-400 mb-4">{p.serversIntro}</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400">
                <tr>
                  <th className="text-left font-medium px-4 py-2">{p.usage}</th>
                  <th className="text-left font-medium px-4 py-2">{p.specs}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-gray-200">{p.usageTest}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-gray-400">2 vCPU · 4 Go RAM · 40 Go SSD — VPS (OVH, Hetzner, Scaleway…)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-gray-200">{p.usageProd}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-gray-400">4 vCPU · 8 Go RAM · 80 Go SSD · sauvegardes régulières</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-gray-200">{p.os}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-gray-400">Ubuntu 22.04 / 24.04 LTS · Docker + plugin Compose (≥ 2.24)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Déploiement */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{p.deployTitle}</h2>
          <p className="text-slate-600 dark:text-gray-400 mb-4">{p.deployIntro}</p>
          <pre className="rounded-xl bg-slate-900 dark:bg-black text-slate-100 p-4 text-sm overflow-x-auto border border-transparent dark:border-gray-800"><code>{
`git clone ${GITHUB_URL}.git && cd acra
./scripts/setup.sh          # génère les secrets et le fichier .env
docker compose up -d        # db + migrations + application`}</code></pre>
          <p className="text-slate-600 dark:text-gray-400 mt-4">{p.deployProd}</p>
        </section>

        {/* Bonnes pratiques */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{p.prodTitle}</h2>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-gray-300 list-disc pl-5">
            <li>{p.prod1}</li>
            <li>{p.prod2}</li>
            <li>{p.prod3}</li>
            <li>{p.prod4}</li>
          </ul>
        </section>

        {/* CTA */}
        <div className="flex flex-wrap gap-3 border-t border-slate-200 dark:border-gray-800 pt-8">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-medium hover:bg-slate-800 dark:hover:bg-gray-200">
            {p.githubCta}
          </a>
          <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-gray-700 text-slate-700 dark:text-gray-200 font-medium hover:bg-slate-100 dark:hover:bg-gray-800">
            {p.guideCta}
          </a>
        </div>
      </main>
    </div>
  )
}
