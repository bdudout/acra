'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getT, LOCALES, type Locale } from '@/lib/i18n'
import { construireSignalement, urlNouvelleIssue } from '@/lib/signalement-erreur'

type ErrorKind = 'notFound' | 'unauthorized' | 'forbidden' | 'error'

/** Écran de repli autonome : il reste disponible même si les Providers ont échoué. */
export default function ErrorScreen({ kind, onRetry, digest }: { kind: ErrorKind; onRetry?: () => void; digest?: string }) {
  const [locale, setLocale] = useState<Locale>('fr')
  // Signalement GitHub (erreur applicative) : version installée lue sur /api/health (public, disponible même base
  // indisponible) ; issue pré-remplie que la personne relit et envoie elle-même — rien n'est transmis par ACRA.
  const [signalement, setSignalement] = useState<{ url: string; corps: string } | null>(null)
  useEffect(() => {
    if (kind !== 'error') return
    let actif = true
    const preparer = (v: { version?: string; revision?: string; issuesRepo?: string }) => {
      if (!actif) return
      const s = construireSignalement({ version: v.version ?? 'inconnue', revision: v.revision ?? 'inconnue', statut: 500, chemin: window.location.pathname, digest, date: new Date(), userAgent: navigator.userAgent, langue: document.documentElement.lang || navigator.language })
      setSignalement({ url: urlNouvelleIssue(v.issuesRepo ?? '', s.titre, s.corps), corps: s.corps })
    }
    fetch('/api/health', { cache: 'no-store' }).then(r => r.json()).then(preparer).catch(() => preparer({}))
    return () => { actif = false }
  }, [kind, digest])
  useEffect(() => {
    const cookie = document.cookie.split('; ').find(value => value.startsWith('acra-locale='))?.split('=')[1] as Locale
    const detected = cookie || navigator.language.split('-')[0]
    if (LOCALES.includes(detected as Locale)) setLocale(detected as Locale)
  }, [])
  const copy = getT(locale).errorScreen[kind]

  return <main id="main-content" className="flex min-h-[70vh] items-center justify-center bg-linear-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-white">
    <section className="w-full max-w-xl rounded-3xl border border-white/15 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-sm sm:p-12" aria-labelledby="error-title">
      <img src="/logo-mark.png" alt="ACRA" width={334} height={384} className="mx-auto mb-7 h-16 w-auto" />
      <p className="font-mono text-7xl font-black tracking-tight text-cyan-300">{kind === 'notFound' ? '404' : kind === 'unauthorized' ? '401' : kind === 'forbidden' ? '403' : '500'}</p>
      <h1 id="error-title" className="mt-4 text-2xl font-bold sm:text-3xl">{copy.title}</h1>
      <p className="mt-3 text-base leading-7 text-slate-200">{copy.description}</p>
      <p className="mt-5 rounded-xl bg-black/20 p-3 text-sm text-cyan-100">{copy.fun}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary bg-white! text-slate-950! shadow-lg hover:bg-cyan-100!">{copy.home}</Link>
        {(kind === 'error' || kind === 'unauthorized') && onRetry && <button type="button" onClick={onRetry} className="btn-secondary border-white/30 bg-white/10 text-white hover:bg-white/20">{copy.retry}</button>}
      </div>
      {signalement && <div className="mt-6 text-left text-sm text-slate-200">
        <a href={signalement.url} target="_blank" rel="noopener noreferrer" className="inline-block underline decoration-cyan-300 underline-offset-4 hover:text-cyan-200">{getT(locale).errorScreen.signaler.lien}</a>
        <p className="mt-2 text-xs text-slate-300">{getT(locale).errorScreen.signaler.note}</p>
        <details className="mt-2 text-xs"><summary className="cursor-pointer text-cyan-100">{getT(locale).errorScreen.signaler.apercu}</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-slate-200">{signalement.corps}</pre>
        </details>
      </div>}
    </section>
  </main>
}
