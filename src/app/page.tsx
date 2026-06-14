'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import LanguageSwitcher from '@/components/LanguageSwitcher'

const WORKSHOPS = [
  { num: 1, icon: '🎯', titleKey: 'w1', descKey: 'w1d' },
  { num: 2, icon: '🎭', titleKey: 'w2', descKey: 'w2d' },
  { num: 3, icon: '🗺️', titleKey: 'w3', descKey: 'w3d' },
  { num: 4, icon: '⚙️', titleKey: 'w4', descKey: 'w4d' },
  { num: 5, icon: '🛡️', titleKey: 'w5', descKey: 'w5d' },
]

const WS_TITLES: Record<string, Record<string, string>> = {
  fr: { w1: 'Cadrage', w1d: 'Périmètre, biens supports, événements redoutés, socle de sécurité', w2: 'Sources de risque', w2d: 'Identification des attaquants et de leurs objectifs', w3: 'Scénarios stratégiques', w3d: "Chemins d'attaque via l'écosystème", w4: 'Scénarios opérationnels', w4d: 'Détail technique des attaques', w5: 'Traitement', w5d: "Mesures de sécurité et plan d'action" },
  en: { w1: 'Scoping', w1d: 'Scope, supporting assets, feared events, security baseline', w2: 'Risk sources', w2d: 'Identifying attackers and their objectives', w3: 'Strategic scenarios', w3d: 'Attack paths through the ecosystem', w4: 'Operational scenarios', w4d: 'Technical detail of attacks', w5: 'Treatment', w5d: 'Security measures and action plan' },
  it: { w1: 'Scoping', w1d: 'Perimetro, asset di supporto, eventi temuti, baseline di sicurezza', w2: 'Fonti di rischio', w2d: 'Identificazione degli aggressori e dei loro obiettivi', w3: 'Scenari strategici', w3d: "Percorsi di attacco attraverso l'ecosistema", w4: 'Scenari operativi', w4d: 'Dettaglio tecnico degli attacchi', w5: 'Trattamento', w5d: 'Misure di sicurezza e piano d\'azione' },
  es: { w1: 'Alcance', w1d: 'Perímetro, activos de soporte, eventos temidos, línea base de seguridad', w2: 'Fuentes de riesgo', w2d: 'Identificación de atacantes y sus objetivos', w3: 'Escenarios estratégicos', w3d: 'Rutas de ataque a través del ecosistema', w4: 'Escenarios operativos', w4d: 'Detalle técnico de los ataques', w5: 'Tratamiento', w5d: 'Medidas de seguridad y plan de acción' },
  de: { w1: 'Scoping', w1d: 'Umfang, unterstützende Assets, befürchtete Ereignisse, Sicherheits-Baseline', w2: 'Risikoquellen', w2d: 'Identifizierung von Angreifern und ihren Zielen', w3: 'Strategische Szenarien', w3d: 'Angriffspfade durch das Ökosystem', w4: 'Operative Szenarien', w4d: 'Technische Details von Angriffen', w5: 'Behandlung', w5d: 'Sicherheitsmaßnahmen und Aktionsplan' },
}

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ACRA — Augmented Cyber Risk Analysis',
  applicationCategory: 'SecurityApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  description:
    "Outil guidé de réalisation d'analyses de risques cybersécurité selon la méthode EBIOS RM (ANSSI). 5 ateliers structurés, gestion RBAC, export PDF, compatible ISO 27005.",
  url: 'https://acra-ebios.app',
  author: { '@type': 'Organization', name: 'ACRA Contributors' },
  keywords: 'EBIOS RM, ANSSI, analyse de risques, cybersécurité, ISO 27005',
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t, locale } = useTranslation()

  useEffect(() => {
    if (status === 'authenticated') router.push('/dashboard')
  }, [status, router])

  if (status === 'loading') return null

  const ws = WS_TITLES[locale] ?? WS_TITLES.fr

  return (
    <div className="min-h-screen bg-gradient-to-br from-ebios-950 via-ebios-900 to-indigo-900 text-white">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <Image src="/logo-mark.png" alt="" width={334} height={384} priority className="h-10 w-auto" />
          <div>
            <div className="font-bold text-lg leading-tight">ACRA</div>
            <div className="text-white/40 text-[10px] leading-tight tracking-wide hidden sm:block">
              Augmented Cyber Risk Analysis
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher onDark />
          <Link href="/auth/signin" className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors">
            {t.landing.connect}
          </Link>
          <Link href="/auth/register" className="px-4 py-2 bg-[white] text-[#312e81] text-sm font-medium rounded-lg hover:bg-white/90 transition-colors">
            {t.auth.register.submit}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm mb-6">
          {/* Drapeau FR en SVG (les emojis drapeaux ne s'affichent pas sur Windows) */}
          <svg width="16" height="11" viewBox="0 0 3 2" aria-hidden="true" className="rounded-[1px] flex-shrink-0">
            <rect width="1" height="2" x="0" fill="#0055A4" />
            <rect width="1" height="2" x="1" fill="#FFFFFF" />
            <rect width="1" height="2" x="2" fill="#EF4135" />
          </svg>
          <span>{t.landing.badge}</span>
        </div>
        <h1 className="text-5xl font-bold mb-6 leading-tight">
          {t.landing.heroLine1}<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">
            {t.landing.heroLine2}
          </span>
        </h1>
        <p className="text-xl text-white/70 mb-10 max-w-2xl mx-auto">
          {t.landing.description}
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/auth/register"
            className="px-8 py-4 bg-[white] text-[#312e81] font-bold rounded-xl hover:bg-white/90 transition-all shadow-lg shadow-black/20 text-lg">
            {t.landing.startFree}
          </Link>
          <Link href="/auth/signin"
            className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-all text-lg">
            {t.landing.connect}
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-24 text-left">
          {([
            { icon: '🎯', f: t.landing.features.ateliers   },
            { icon: '💡', f: t.landing.features.guided     },
            // [IA — désactivé] { icon: '🤖', f: t.landing.features.ai },
            { icon: '📊', f: t.landing.features.matrix     },
            { icon: '📥', f: t.landing.features.export     },
            { icon: '🔒', f: t.landing.features.secure     },
          ] as { icon: string; f: { title: string; desc: string } }[]).map(({ icon, f }, i) => (
            <div key={i} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
              <div className="text-3xl mb-3">{icon}</div>
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Ateliers timeline */}
        <div className="mt-24">
          <h2 className="text-3xl font-bold mb-12">{t.landing.workshopsTitle}</h2>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {WORKSHOPS.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl mb-3">
                  {w.icon}
                </div>
                <div className="text-xs font-bold text-white/40 mb-1">ATELIER {w.num}</div>
                <div className="font-semibold text-sm mb-1">{ws[w.titleKey]}</div>
                <div className="text-xs text-white/50 text-center">{ws[w.descKey]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Exemples concrets */}
        <div className="mt-24">
          <h2 className="text-3xl font-bold mb-3">{t.landing.examplesTitle}</h2>
          <p className="text-white/70 mb-12 max-w-2xl mx-auto">{t.landing.examplesSubtitle}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            {t.landing.examples.map((ex, i) => (
              <div key={i} className="bg-white/10 backdrop-blur border border-white/15 rounded-2xl p-6 flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">{ex.sector}</span>
                  <span className="text-xs bg-white/15 text-white/90 rounded-full px-3 py-0.5">{ex.role}</span>
                </div>
                <div className="font-bold text-base">{ex.org}</div>

                {/* Citation */}
                <blockquote className="text-sm text-white/85 leading-relaxed italic border-l-2 border-indigo-300 pl-4">
                  "{ex.quote}"
                </blockquote>

                {/* Résultat */}
                <div className="mt-auto flex items-start gap-2 bg-white/10 rounded-xl p-3">
                  <span className="text-green-300 text-base mt-0.5 flex-shrink-0">✓</span>
                  <p className="text-xs text-white/85 leading-relaxed">{ex.result}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats / social proof */}
        <div className="mt-24 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { value: '5',   label: 'Ateliers EBIOS RM' },
            { value: '5',   label: 'Langues supportées' },
            { value: '100%', label: 'Open-source' },
            { value: 'ISO', label: '27005 compatible' },
          ].map((s, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
              <div className="text-3xl font-bold text-white mb-1">{s.value}</div>
              <div className="text-xs text-white/50 leading-snug">{s.label}</div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-24 text-left max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-10 text-center">Questions fréquentes</h2>
          {[
            {
              q: "Qu'est-ce qu'EBIOS RM ?",
              a: "EBIOS Risk Manager est la méthode officielle de l'ANSSI (Agence Nationale de la Sécurité des Systèmes d'Information) pour réaliser des analyses de risques cybersécurité. Elle est structurée en 5 ateliers progressifs et compatible avec la norme ISO 27005.",
            },
            {
              q: "À qui s'adresse ACRA ?",
              a: "ACRA s'adresse aux RSSI, Risk Managers, consultants et analystes qui souhaitent réaliser ou piloter des analyses EBIOS RM de façon structurée, collaborative et traçable — sans nécessairement être expert de la méthode.",
            },
            {
              q: "ACRA est-il gratuit ?",
              a: "Oui, ACRA est entièrement open-source sous licence MIT. Vous pouvez l'héberger vous-même avec Docker en quelques minutes.",
            },
            {
              q: "Quels formats d'export sont disponibles ?",
              a: "ACRA génère des rapports PDF complets (synthèse executive + détail des 5 ateliers), ainsi que des exports JSON et CSV pour l'intégration avec d'autres outils.",
            },
            {
              q: "Puis-je collaborer à plusieurs sur une analyse ?",
              a: "Oui. ACRA intègre un système RBAC complet : chaque analyse peut être partagée avec des utilisateurs en lecture, édition ou approbation. Les rôles RSSI, Risk Manager, Analyste et Lecteur sont supportés.",
            },
          ].map((item, i) => (
            <details key={i} className="group border-b border-white/10 py-5">
              <summary className="flex items-center justify-between cursor-pointer font-semibold text-white/90 hover:text-white list-none">
                {item.q}
                <span className="text-white/40 group-open:rotate-45 transition-transform text-xl ml-4 flex-shrink-0">+</span>
              </summary>
              <p className="mt-3 text-white/60 text-sm leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>

        {/* CTA final */}
        <div className="mt-24 bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">{t.landing.heroLine1} {t.landing.heroLine2}</h2>
          <p className="text-white/50 mb-8 max-w-lg mx-auto">{t.landing.description}</p>
          <Link href="/auth/register"
            className="inline-block px-10 py-4 bg-[white] text-[#312e81] font-bold rounded-xl hover:bg-white/90 transition-all shadow-lg shadow-black/20 text-lg">
            {t.landing.startFree}
          </Link>
        </div>
      </main>

      <footer className="text-center py-8 text-white/30 text-sm border-t border-white/10 mt-20">
        <p>
          ACRA — Augmented Cyber Risk Analysis. {t.landing.footerMethod}{' '}
          <a href="https://www.ssi.gouv.fr/guide/ebios-risk-manager-la-methode/" target="_blank" rel="noopener" className="underline">{t.landing.footerGuideLink}</a>
        </p>
        <p className="mt-1">{t.landing.footerDisclaim}</p>
      </footer>
    </div>
  )
}
