'use client'

import { FlaskConical, Target, VenetianMask, Map as MapIcon, Settings, ShieldCheck, Lightbulb, BarChart3, Download, Lock, Check, Layers, LogIn, UserPlus, type LucideIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import LanguageSwitcher from '@/components/LanguageSwitcher'

const WORKSHOPS: { num: number; Icon: LucideIcon; titleKey: string; descKey: string }[] = [
  { num: 1, Icon: Target,        titleKey: 'w1', descKey: 'w1d' },
  { num: 2, Icon: VenetianMask,  titleKey: 'w2', descKey: 'w2d' },
  { num: 3, Icon: MapIcon,       titleKey: 'w3', descKey: 'w3d' },
  { num: 4, Icon: Settings,      titleKey: 'w4', descKey: 'w4d' },
  { num: 5, Icon: ShieldCheck,   titleKey: 'w5', descKey: 'w5d' },
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

  // Mode démo : affiche un encart expliquant les règles (données jetables, etc.).
  const [isDemo, setIsDemo] = useState(false)
  useEffect(() => {
    fetch('/api/demo/status').then(r => r.ok ? r.json() : null).then(s => setIsDemo(!!s?.demo)).catch(() => {})
  }, [])

  useEffect(() => {
    if (status === 'authenticated') router.push('/dashboard')
  }, [status, router])

  if (status === 'loading') return null

  const ws = WS_TITLES[locale] ?? WS_TITLES.fr

  return (
    <div data-testid="landing-shell" className="min-h-screen bg-[#f7f9fc] bg-[radial-gradient(ellipse_at_top_left,_rgba(224,231,255,0.58),_transparent_42%),radial-gradient(ellipse_at_92%_18%,_rgba(224,242,254,0.5),_transparent_34%)] text-slate-900">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      {/* Header */}
      <header className="flex items-center justify-between gap-2 px-3 py-3 sm:px-6 sm:py-4 max-w-6xl mx-auto border-x border-b border-indigo-100 bg-gradient-to-r from-[#eef2ff] via-[#ffffff] to-[#e0f2fe] rounded-b-2xl shadow-sm">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Image src="/logo-mark.png" alt="" width={334} height={384} priority className="h-8 w-auto sm:h-10" />
          <div className="min-w-0">
            <div className="font-bold text-base leading-tight sm:text-lg">ACRA</div>
            <div className="text-slate-500 text-[10px] leading-tight tracking-wide hidden sm:block">
              Augmented Cyber Risk Analysis
            </div>
          </div>
        </div>
        <div data-testid="landing-actions" className="flex shrink-0 items-center gap-0.5 sm:gap-3">
          <LanguageSwitcher />
          <Link href="/auth/signin" aria-label={t.landing.connect} className="inline-flex items-center justify-center rounded-lg p-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-ebios-700 transition-colors sm:px-4">
            <LogIn size={18} className="sm:hidden" aria-hidden="true" />
            <span className="hidden sm:inline">{t.landing.connect}</span>
          </Link>
          <Link href="/auth/register" aria-label={t.auth.register.submit} className="inline-flex items-center justify-center rounded-lg bg-ebios-600 p-2 text-sm font-medium text-white shadow-sm hover:bg-ebios-700 transition-colors sm:px-4">
            <UserPlus size={18} className="sm:hidden" aria-hidden="true" />
            <span className="hidden sm:inline">{t.auth.register.submit}</span>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-4 py-12 text-center sm:px-6 sm:py-20">

        <h1 className="text-4xl font-bold mb-6 leading-tight sm:text-5xl">
          {t.landing.heroLine1}<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-ebios-600 to-sky-600">
            {t.landing.heroLine2}
          </span>
        </h1>
        <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto sm:text-xl">
          {t.landing.description}
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/auth/register"
            className="px-8 py-4 bg-ebios-600 text-white font-bold rounded-xl hover:bg-ebios-700 transition-all shadow-lg shadow-ebios-900/15 text-lg">
            {t.landing.startFree}
          </Link>
          <Link href="/auth/signin"
            className="px-8 py-4 border border-slate-300 bg-[#ffffff] hover:bg-slate-100 text-slate-700 font-medium rounded-xl transition-all text-lg">
            {t.landing.connect}
          </Link>
        </div>

        <div data-testid="method-badge" className="inline-flex items-center gap-2 mt-10 bg-[#f0f4ff] border border-ebios-100 text-[#3730a3] rounded-full px-4 py-1.5 text-sm">
          {locale === 'fr' && (
            <svg data-testid="fr-method-flag" width="16" height="11" viewBox="0 0 3 2" aria-hidden="true" className="rounded-[1px] flex-shrink-0">
              <rect width="1" height="2" x="0" fill="#0055A4" />
              <rect width="1" height="2" x="1" fill="#FFFFFF" />
              <rect width="1" height="2" x="2" fill="#EF4135" />
            </svg>
          )}
          <span>{t.landing.badge}</span>
        </div>

        {/* Encart mode démonstration — règles pour le visiteur (ACRA-Demo). */}
        {isDemo && (
          <section data-testid="demo-notice" className="max-w-4xl mx-auto mt-10 text-left overflow-hidden rounded-2xl border border-indigo-200 bg-[#f8faff] shadow-sm">
            <div className="flex items-center gap-3 bg-gradient-to-r from-[#4f46e5] to-[#0284c7] px-6 py-4 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15" aria-hidden="true"><FlaskConical size={20} /></span>
              <div className="font-semibold">{t.demo.homeTitle}</div>
            </div>
            <ul className="grid gap-x-8 gap-y-3 px-6 py-5 text-sm text-slate-700 md:grid-cols-2">
              <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#4f46e5]" aria-hidden="true" />{t.demo.homeRule1}</li>
              <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#4f46e5]" aria-hidden="true" />{t.demo.homeRule2}</li>
              <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#4f46e5]" aria-hidden="true" />{t.demo.homeRule3}</li>
              <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#4f46e5]" aria-hidden="true" />{t.demo.homeRule4}</li>
            </ul>
          </section>
        )}

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-24 text-left">
          {([
            { Icon: Target,      f: t.landing.features.ateliers   },
            { Icon: Lightbulb,   f: t.landing.features.guided     },
            { Icon: BarChart3,   f: t.landing.features.matrix     },
            { Icon: Download,    f: t.landing.features.export     },
            { Icon: Lock,        f: t.landing.features.secure     },
            { Icon: Layers,      f: t.landing.features.grc        },
          ] as { Icon: LucideIcon; f: { title: string; desc: string } }[]).map(({ Icon, f }, i) => (
            <div key={i} className="bg-[#ffffff] border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="mb-3 text-[#4f46e5]"><Icon size={28} aria-hidden="true" /></div>
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Ateliers timeline */}
        <div className="mt-24">
          <h2 className="text-3xl font-bold mb-12">{t.landing.workshopsTitle}</h2>
          <div data-testid="landing-workshops" className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-4">
            {WORKSHOPS.map((w, i) => (
              <div key={i} className="flex w-full flex-col items-center sm:flex-1">
                <div className="w-12 h-12 rounded-xl bg-[#f0f4ff] border border-ebios-100 text-[#4338ca] flex items-center justify-center text-2xl mb-3">
                  <w.Icon size={24} aria-hidden="true" />
                </div>
                <div className="text-xs font-bold text-slate-500 mb-1">ATELIER {w.num}</div>
                <div className="font-semibold text-sm mb-1">{ws[w.titleKey]}</div>
                <div className="text-xs text-slate-500 text-center">{ws[w.descKey]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Exemples concrets */}
        <div className="mt-24">
          <h2 className="text-3xl font-bold mb-3">{t.landing.examplesTitle}</h2>
          <p className="text-slate-600 mb-12 max-w-2xl mx-auto">{t.landing.examplesSubtitle}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            {t.landing.examples.map((ex, i) => (
              <div key={i} className="bg-[#ffffff] border border-slate-200 rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
                {/* En-tête : secteur + profil type (pas une personne réelle) */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#4f46e5]">{ex.sector}</span>
                  <span className="text-xs bg-slate-100 text-slate-700 rounded-full px-3 py-0.5">{t.landing.examplesProfileLabel} : {ex.role}</span>
                </div>
                <div className="font-bold text-base">{ex.org}</div>

                {/* Scénario illustratif — description de situation, PAS un témoignage. */}
                <div className="border-l-2 border-ebios-300 pl-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#4f46e5] mb-1">{t.landing.examplesScenarioTag}</div>
                  <p className="text-sm text-slate-700 leading-relaxed">{ex.quote}</p>
                </div>

                {/* Résultat */}
                <div className="mt-auto flex items-start gap-2 bg-[#ecfdf5] rounded-xl p-3">
                  <Check size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <p className="text-xs text-slate-700 leading-relaxed">{ex.result}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chiffres clés — sources publiques réelles (pas de faux témoignages) */}
        <div className="mt-24">
          <h2 className="text-3xl font-bold mb-3">{t.landing.facts.title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
            {t.landing.facts.items.map((fact, i) => (
              <div key={i} className="bg-[#ffffff] border border-slate-200 rounded-2xl p-6 text-left shadow-sm">
                <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-ebios-600 to-sky-600 mb-2">{fact.value}</div>
                <p className="text-sm text-slate-700 leading-relaxed mb-2">{fact.label}</p>
                <span className="text-[11px] uppercase tracking-wide text-slate-500">{fact.source}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-4 max-w-3xl">{t.landing.facts.note}</p>
        </div>

        {/* Stats / social proof */}
        <div className="mt-24 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { value: '5' },
            { value: '5' },
            { value: '100%' },
            { value: 'ISO' },
          ].map((s, i) => (
            <div key={i} className="bg-[#ffffff] border border-slate-200 rounded-2xl p-5 text-center shadow-sm">
              <div className="text-3xl font-bold text-[#4338ca] mb-1">{s.value}</div>
              <div className="text-xs text-slate-500 leading-snug">{t.landing.statLabels[i]}</div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-24 text-left max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-10 text-center">{t.landing.faq.title}</h2>
          {t.landing.faq.items.map((item, i) => (
            <details key={i} className="group border-b border-slate-200 py-5">
              <summary className="flex items-center justify-between cursor-pointer font-semibold text-slate-800 hover:text-ebios-700 list-none">
                {item.q}
                <span className="text-slate-400 group-open:rotate-45 transition-transform text-xl ml-4 flex-shrink-0">+</span>
              </summary>
              <p className="mt-3 text-slate-600 text-sm leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>

        {/* CTA final */}
        <div className="mt-24 bg-[#f0f4ff] border border-ebios-100 rounded-3xl p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">{t.landing.heroLine1} {t.landing.heroLine2}</h2>
          <p className="text-slate-600 mb-8 max-w-lg mx-auto">{t.landing.description}</p>
          <Link href="/auth/register"
            className="inline-block px-10 py-4 bg-ebios-600 text-white font-bold rounded-xl hover:bg-ebios-700 transition-all shadow-lg shadow-ebios-900/15 text-lg">
            {t.landing.startFree}
          </Link>
        </div>
      </main>

      <footer className="text-center py-8 text-slate-500 text-sm border-t border-slate-200 mt-20">
        <p>
          ACRA — Augmented Cyber Risk Analysis. {t.landing.footerMethod}{' '}
          <a href="https://www.ssi.gouv.fr/guide/ebios-risk-manager-la-methode/" target="_blank" rel="noopener" className="underline">{t.landing.footerGuideLink}</a>
        </p>
        <p className="mt-1">{t.landing.footerDisclaim}</p>
      </footer>
    </div>
  )
}
