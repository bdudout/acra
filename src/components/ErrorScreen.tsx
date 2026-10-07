'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getT, LOCALES, type Locale } from '@/lib/i18n'

type ErrorKind = 'notFound' | 'unauthorized' | 'forbidden' | 'error'

/** Écran de repli autonome : il reste disponible même si les Providers ont échoué. */
export default function ErrorScreen({ kind, onRetry }: { kind: ErrorKind; onRetry?: () => void }) {
  const [locale, setLocale] = useState<Locale>('fr')
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
    </section>
  </main>
}
